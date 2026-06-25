# Enquiry Supabase Submission — Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `setTimeout` submission on `/contact` with a real Supabase insert so that customer enquiries reach the studio and appear in the admin portal.

**Architecture:** A service function (`createEnquiry`) handles DB write and payload normalization. A `'use server'` Server Action (`submitEnquiry`) wraps the service with validation and shapes a typed result. The contact page (already `"use client"`) calls the action in its existing `handleSubmit` and renders success or error UI.

**Tech Stack:** Next.js 16 Server Actions (`'use server'`), `@supabase/supabase-js` (anon key, same as all existing services), Vitest for unit tests.

---

## Pre-Implementation Findings

### Schema findings (`src/lib/supabase/database.ts`)

| Column | Exists | Type | Notes |
|---|---|---|---|
| `id` | ✅ | `string` (uuid) | auto-generated |
| `name` | ✅ | `string` | required |
| `email` | ✅ | `string` | required |
| `phone` | ✅ | `string \| null` | optional |
| `occasion` | ✅ | `string \| null` | optional |
| `budget` | ✅ | `string \| null` | optional |
| `message` | ✅ | `string` | required |
| `status` | ✅ | `'NEW' \| 'REPLIED' \| 'CLOSED'` | default `'NEW'` |
| `measurements` | ❌ | — | **does not exist** — dependency for MEI-25 |
| `reference_images` | ❌ | — | **does not exist** — dependency for MEI-25 |

No `supabase/migrations/` directory exists; `database.ts` is the source of truth.

### AC3 / AC4 findings

- `measurements` column does not exist in the current schema. MEI-25 must add it before persistence can be implemented.
- `reference_images` column does not exist in the current schema. MEI-25 must add it before persistence can be implemented.
- Neither column needs to be in scope for MEI-33.

### Admin portal

The admin portal is a **separate application** (not in this repo). It reads from the same Supabase `enquiries` table. Any row inserted with `status: 'NEW'` automatically appears in the admin enquiries list. No code change is needed in the admin portal.

### Existing patterns (services)

- `src/lib/services/products.ts` and `categories.ts`: use `createClient` from `@supabase/supabase-js` (no cookies — safe for writes with anon RLS).
- `getServiceClient()` factory with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Throw the raw Supabase error after logging to `console.error("[ServiceName:operation]", error)`.
- Tests: mock `@supabase/supabase-js`, build fluent chain, `beforeEach` sets env vars.
- No `unstable_cache` on mutations.

### No existing Server Actions

`src/app/*/actions.ts` — no results. `src/app/contact/actions.ts` will be the first.

---

## File Map

| Path | Change | Responsibility |
|---|---|---|
| `src/lib/services/enquiries.ts` | **Create** | Trim inputs, build insert payload, call Supabase, throw on error |
| `src/lib/services/__tests__/enquiries.test.ts` | **Create** | Unit tests for `createEnquiry` |
| `src/app/contact/actions.ts` | **Create** | `'use server'` boundary: validate, call service, return typed result |
| `src/app/contact/__tests__/actions.test.ts` | **Create** | Unit tests for `submitEnquiry` |
| `src/app/contact/page.tsx` | **Modify** | Call `submitEnquiry`, add `submitError` state, render error banner |

---

### Task 1: Service — `createEnquiry()`

**Files:**
- Create: `src/lib/services/enquiries.ts`
- Create: `src/lib/services/__tests__/enquiries.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/services/__tests__/enquiries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createEnquiry } from "../enquiries";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function makeInsertChain(result: {
  data: { id: string } | null;
  error: null | { message: string; code?: string };
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.insert = vi.fn(self);
  chain.select = vi.fn(self);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

const validInput = {
  name: "  Priya Sharma  ",
  email: "  priya@example.com  ",
  phone: "+91 98765 43210",
  occasion: "bridal",
  budget: "2l-3l",
  message: "  Looking for a red bridal lehenga with Zardosi work.  ",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("createEnquiry", () => {
  it("trims all string fields and inserts with status NEW, returns id", async () => {
    const chain = makeInsertChain({ data: { id: "enq-1" }, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await createEnquiry(validInput);

    expect(result).toEqual({ id: "enq-1" });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Priya Sharma",
        email: "priya@example.com",
        message: "Looking for a red bridal lehenga with Zardosi work.",
        status: "NEW",
      })
    );
  });

  it("coerces empty-string optional fields to null", async () => {
    const chain = makeInsertChain({ data: { id: "enq-2" }, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    await createEnquiry({ ...validInput, phone: "  ", occasion: "", budget: "" });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, occasion: null, budget: null })
    );
  });

  it("throws (and logs) on Supabase error", async () => {
    const chain = makeInsertChain({ data: null, error: { message: "Insert failed" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createEnquiry(validInput)).rejects.toMatchObject({ message: "Insert failed" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[EnquiriesService:createEnquiry]"),
      expect.anything()
    );
    spy.mockRestore();
  });
});
```

- [ ] **Step 1.2: Run — expect FAIL (module not found)**

```
npm test -- --reporter=verbose src/lib/services/__tests__/enquiries.test.ts
```

Expected: FAIL with `Cannot find module '../enquiries'`

- [ ] **Step 1.3: Implement the service**

Create `src/lib/services/enquiries.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

type EnquiryInsert = Database["public"]["Tables"]["enquiries"]["Insert"];

export interface CreateEnquiryInput {
  name: string;
  email: string;
  phone: string;
  occasion: string;
  budget: string;
  message: string;
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createEnquiry(
  input: CreateEnquiryInput
): Promise<{ id: string }> {
  const supabase = getServiceClient();

  const row: EnquiryInsert = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim() || null,
    occasion: input.occasion.trim() || null,
    budget: input.budget.trim() || null,
    message: input.message.trim(),
    status: "NEW",
  };

  const { data, error } = await supabase
    .from("enquiries")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[EnquiriesService:createEnquiry]", error);
    throw error;
  }

  return { id: data.id };
}
```

- [ ] **Step 1.4: Run — expect PASS**

```
npm test -- --reporter=verbose src/lib/services/__tests__/enquiries.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 1.5: Full suite — no regressions**

```
npm test
```

Expected: all tests PASS

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/services/enquiries.ts src/lib/services/__tests__/enquiries.test.ts
git commit -m "feat(enquiries): add createEnquiry service with trimming and Supabase insert"
```

---

### Task 2: Server Action — `submitEnquiry()`

**Files:**
- Create: `src/app/contact/actions.ts`
- Create: `src/app/contact/__tests__/actions.test.ts`

The Server Action is the `'use server'` boundary. It runs server-side validation (defense-in-depth against direct POST calls bypassing client validation) and converts service throws into typed failure results.

- [ ] **Step 2.1: Write failing tests**

Create `src/app/contact/__tests__/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/enquiries", () => ({
  createEnquiry: vi.fn(),
}));

import { submitEnquiry } from "../actions";
import { createEnquiry } from "@/lib/services/enquiries";

const validData = {
  name: "Priya Sharma",
  email: "priya@example.com",
  phone: "+91 98765 43210",
  occasion: "bridal",
  budget: "2l-3l",
  message: "Looking for a bridal lehenga.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitEnquiry", () => {
  it("returns success when createEnquiry resolves", async () => {
    vi.mocked(createEnquiry).mockResolvedValue({ id: "enq-1" });

    const result = await submitEnquiry(validData);

    expect(result).toEqual({ success: true });
    expect(createEnquiry).toHaveBeenCalledWith(validData);
  });

  it("returns failure when createEnquiry throws", async () => {
    vi.mocked(createEnquiry).mockRejectedValue(new Error("DB error"));

    const result = await submitEnquiry(validData);

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
  });

  it("returns validation error and skips service when name is whitespace", async () => {
    const result = await submitEnquiry({ ...validData, name: "   " });
    expect(result).toEqual({ success: false, error: "Name is required." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when email is empty", async () => {
    const result = await submitEnquiry({ ...validData, email: "" });
    expect(result).toEqual({ success: false, error: "Email is required." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error for malformed email", async () => {
    const result = await submitEnquiry({ ...validData, email: "not-an-email" });
    expect(result).toEqual({ success: false, error: "Invalid email format." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when phone is empty", async () => {
    const result = await submitEnquiry({ ...validData, phone: "" });
    expect(result).toEqual({ success: false, error: "Phone number is required." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when occasion is empty", async () => {
    const result = await submitEnquiry({ ...validData, occasion: "" });
    expect(result).toEqual({ success: false, error: "Please select an occasion." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when budget is empty", async () => {
    const result = await submitEnquiry({ ...validData, budget: "" });
    expect(result).toEqual({ success: false, error: "Please select a budget range." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2: Run — expect FAIL (module not found)**

```
npm test -- --reporter=verbose src/app/contact/__tests__/actions.test.ts
```

Expected: FAIL with `Cannot find module '../actions'`

- [ ] **Step 2.3: Implement the Server Action**

Create `src/app/contact/actions.ts`:

```ts
"use server";

import { createEnquiry, type CreateEnquiryInput } from "@/lib/services/enquiries";

export type SubmitEnquiryResult =
  | { success: true }
  | { success: false; error: string };

export async function submitEnquiry(
  data: CreateEnquiryInput
): Promise<SubmitEnquiryResult> {
  if (!data.name?.trim()) return { success: false, error: "Name is required." };
  if (!data.email?.trim()) return { success: false, error: "Email is required." };
  if (!/\S+@\S+\.\S+/.test(data.email.trim())) return { success: false, error: "Invalid email format." };
  if (!data.phone?.trim()) return { success: false, error: "Phone number is required." };
  if (!data.occasion?.trim()) return { success: false, error: "Please select an occasion." };
  if (!data.budget?.trim()) return { success: false, error: "Please select a budget range." };

  try {
    await createEnquiry(data);
    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
```

- [ ] **Step 2.4: Run — expect PASS**

```
npm test -- --reporter=verbose src/app/contact/__tests__/actions.test.ts
```

Expected: 8 tests PASS

- [ ] **Step 2.5: Full suite — no regressions**

```
npm test
```

Expected: all tests PASS

- [ ] **Step 2.6: Commit**

```bash
git add src/app/contact/actions.ts src/app/contact/__tests__/actions.test.ts
git commit -m "feat(contact): add submitEnquiry server action with validation"
```

---

### Task 3: Wire the Contact Form

**Files:**
- Modify: `src/app/contact/page.tsx` (lines ~1–65 are the stateful logic; line ~249 is the submit button area)

Changes:
1. Import `submitEnquiry`
2. Add `submitError` state (string | null)
3. Make `handleSubmit` async — call the action, handle the result
4. Guard against duplicate submits
5. Render an accessible error banner above the submit button

- [ ] **Step 3.1: Add the import**

Open `src/app/contact/page.tsx`. After the existing imports block, add:

```ts
import { submitEnquiry } from "./actions";
```

The complete top of the file should now be:

```ts
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { submitEnquiry } from "./actions";
```

- [ ] **Step 3.2: Add `submitError` state**

After the existing line:
```ts
  const [isSubmitting, setIsSubmitting] = useState(false);
```

Add:
```ts
  const [submitError, setSubmitError] = useState<string | null>(null);
```

- [ ] **Step 3.3: Replace `handleSubmit`**

Replace the entire `handleSubmit` function (currently lines 52–63):

Old:
```ts
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };
```

New:
```ts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submitEnquiry(formData);

    setIsSubmitting(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setSubmitError(result.error);
    }
  };
```

- [ ] **Step 3.4: Add the error banner in JSX**

Locate the submit button section (currently starts with `{/* Submit */}`):

```tsx
          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
```

Insert the error banner immediately above the `{/* Submit */}` comment:

```tsx
          {submitError && (
            <div role="alert" className="text-sm text-red-600 border border-red-200 bg-red-50 py-3 px-4 text-center">
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
```

- [ ] **Step 3.5: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3.6: Full suite**

```
npm test
```

Expected: all tests PASS

- [ ] **Step 3.7: Lint**

```
npm run lint
```

Expected: no errors

- [ ] **Step 3.8: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat(contact): replace fake submission with submitEnquiry server action"
```

---

### Task 4: Verification Gate

This task produces the evidence required by the completion gate. Every item must be checked before the ticket can be marked DONE.

- [ ] **Step 4.1: Final test run (save output)**

```
npm test
```

Record the full output. All tests must PASS.

- [ ] **Step 4.2: Lint run (save output)**

```
npm run lint
```

Must complete with no errors.

- [ ] **Step 4.3: TypeScript run (save output)**

```
npx tsc --noEmit
```

Must complete with no errors.

- [ ] **Step 4.4: Start dev server**

```
npm run dev
```

Keep running for the manual scenarios below.

---

#### Scenario 1 — Valid enquiry (AC1 + AC2 + AC5)

1. Open `http://localhost:3000/contact`
2. Fill all fields:
   - Name: `Test Customer`
   - Email: `test@example.com`
   - Phone: `+91 99999 99999`
   - Occasion: `Bridal Lehenga`
   - Budget: `₹2,00,000 - ₹3,00,000`
   - Message: `MEI-33 integration test submission`
3. Click **Submit Enquiry**
4. **Expected**: Success screen appears ("Inquiry Received" heading with checkmark)
5. Open Supabase Dashboard → Table Editor → `enquiries`
6. **Expected**: New row present with `status = 'NEW'`, all fields matching

AC1 ✅ row inserted | AC5 ✅ success UI

For AC2 (admin visibility): the admin portal reads from the same `enquiries` table. The row inserted above automatically appears there. Confirm by opening the admin portal and checking the enquiries list.

---

#### Scenario 2 — Empty optional fields (nullability)

1. Fill all required fields; leave Message empty
2. Submit
3. **Expected**: success screen
4. In Supabase: verify `phone`, `occasion`, `budget` stored as their submitted values; verify trimmed strings are saved (no leading/trailing whitespace)

---

#### Scenario 3 — Error state (AC6)

To test the error UI without breaking the environment, temporarily rename the `NEXT_PUBLIC_SUPABASE_URL` env var in `.env.local` to an invalid value (e.g., `https://invalid.test.invalid`), then restart the dev server (`npm run dev`).

1. Submit a valid enquiry
2. **Expected**: Error banner appears reading "Something went wrong. Please try again."
3. **Expected**: Form fields remain populated (not cleared)
4. **Expected**: Submit button is re-enabled

Restore `.env.local` and restart dev server when done.

AC6 ✅ error UI

---

#### Scenario 4 — Duplicate submit prevention

1. Open browser DevTools → Network tab
2. Submit a valid enquiry
3. While the request is in flight, click **Submit Enquiry** again
4. **Expected**: Only one `POST` request sent; button is disabled during submission
5. **Expected**: Only one row inserted in Supabase

---

#### Scenario 5 — Regression check

Verify no existing functionality broke:

| Page | URL | Check |
|---|---|---|
| Homepage | `http://localhost:3000/` | Loads, categories displayed |
| Shop | `http://localhost:3000/shop` | Products listed |
| Contact | `http://localhost:3000/contact` | Form renders, validation still works client-side |

- [ ] **Step 4.5: Document all evidence**

Write a brief summary with:
- Screenshot or paste of Supabase row
- Terminal output of `npm test`, `npm run lint`, `npx tsc --noEmit`
- Confirmation of all 5 scenarios

Only after all evidence is collected → mark ticket DONE.

---

## AC Coverage Matrix

| Acceptance Criterion | Implemented By | Verification |
|---|---|---|
| AC1: Insert row on submit | Service (Task 1) + Action (Task 2) + Form (Task 3) | Scenario 1 |
| AC2: Appears in admin list | Auto — admin reads same table, no code change needed | Scenario 1 (open admin portal) |
| AC3: Measurements persist | ❌ `measurements` column absent from schema — **blocked on MEI-25** | N/A |
| AC4: Reference images persist | ❌ `reference_images` column absent from schema — **blocked on MEI-25** | N/A |
| AC5: Success state | `setSubmitted(true)` → existing success screen (Task 3) | Scenario 1 |
| AC6: Error state | `submitError` state + `role="alert"` banner (Task 3) | Scenario 3 |
| Prevent duplicate submits | `if (isSubmitting) return` guard + `disabled` button | Scenario 4 |
| Input sanitization | `.trim()` + `\|\| null` in service (Task 1) | Service unit tests + Scenario 2 |
| No `any` / unsafe casts | Typed throughout via `Database` type | `npx tsc --noEmit` |

---

## Self-Review

**Spec coverage check:**
- "validation" in Server Action — ✅ 6 validation rules with tests
- "payload normalization" in service — ✅ trim + null coercion with tests
- "error logging" — ✅ `console.error("[EnquiriesService:createEnquiry]", error)`
- "prevent duplicate submits" — ✅ `if (isSubmitting) return` guard
- "no `any`" — ✅ service uses `Database` generic, action uses `CreateEnquiryInput`
- "accessibility" — ✅ `role="alert"` on error banner, `disabled={isSubmitting}` on button

**Placeholder scan:** None found.

**Type consistency:**
- `CreateEnquiryInput` defined in `enquiries.ts` Task 1.3, re-exported in `actions.ts` Task 2.3 — same type.
- `SubmitEnquiryResult` defined in `actions.ts` Task 2.3, consumed in `page.tsx` Task 3.3 — `result.success` discriminant used correctly.
- `formData` in `page.tsx` has keys `{ name, email, phone, occasion, budget, message }` — exact match for `CreateEnquiryInput`.
