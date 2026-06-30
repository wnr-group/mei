# MEI-20 Razorpay Hosted Checkout — Surgical Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the real Razorpay hosted checkout modal to open and complete a payment, replacing the active bypass mode that currently skips the modal entirely.

**Architecture:** The storefront calls `/api/razorpay/create-order` (Next.js route) to create a Razorpay order server-side, then opens the Razorpay SDK modal. On success the modal's `handler` callback calls the `createOrder` service which invokes the Supabase Edge Function `create-order` to verify the HMAC signature and write to the database.

**Tech Stack:** Next.js App Router, Razorpay JS SDK (`checkout.js`), Supabase Edge Functions (Deno), Vitest, TypeScript

## Global Constraints

- **SURGICAL FIX ONLY** — touch nothing outside: `.env.local`, `mei-admin/.env.local`, `tsconfig.json`, the new test file at `src/app/api/razorpay/create-order/__tests__/route.test.ts`
- Do NOT modify: `src/app/checkout/page.tsx`, `src/lib/services/orders.ts`, `mei-admin/supabase/functions/create-order/index.ts`, or any file not listed under "Files"
- All tests must remain passing: `npm run lint`, `npx tsc --noEmit`, `npm test`
- TDD: write tests before any implementation change

---

## Findings — Root Cause and Pre-Conditions

**Root Cause (confirmed by code inspection):**
`NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true` in `.env.local` causes `/api/razorpay/create-order/route.ts:48` to return `{ bypass: true }`, which causes `checkout/page.tsx:164` to skip the Razorpay modal entirely.

**Secondary Blockers:**
1. `RAZORPAY_KEY_SECRET=test_razorpay_key_secret_for_dev` in `.env.local` is a placeholder — Razorpay API would reject it with 401 even with bypass disabled.
2. `ENABLE_PAYMENT_BYPASS=true` + `RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here` in `mei-admin/.env.local` — Edge Function also runs in bypass mode and has no real secret for HMAC verification.
3. `tsconfig.json` includes `**/*.ts` which captures `mei-admin/supabase/functions/create-order/index.ts` (Deno file), causing `npx tsc --noEmit` to fail with 10 Deno-related errors — a **pre-existing** breakage that blocks the testing requirement.

**Code Status:** All four implementation files (`checkout/page.tsx`, `api/razorpay/create-order/route.ts`, `services/orders.ts`, Edge Function) are **correct and complete**. No code bugs. Zero tests exist for the API route.

**Test Status:** 79 tests currently pass across 8 files. No test file exists for `src/app/api/razorpay/create-order/route.ts`.

---

## File Map

| Action | Path | What changes |
|--------|------|--------------|
| Modify | `tsconfig.json` | Add `"mei-admin"` to `exclude` so `npx tsc --noEmit` passes |
| Create | `src/app/api/razorpay/create-order/__tests__/route.test.ts` | Full test coverage for the API route |
| Modify | `.env.local` | Set `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false`; set real `RAZORPAY_KEY_SECRET` |
| Modify | `mei-admin/.env.local` | Set `ENABLE_PAYMENT_BYPASS=false`; set real `RAZORPAY_KEY_SECRET` |
| Shell | Supabase CLI | Deploy Edge Function secrets to Supabase cloud |

---

## Prerequisite — Obtain Real Razorpay Test Credentials

**Before starting any task:** you need the real Razorpay test key secret.

- [ ] Log in to [https://dashboard.razorpay.com](https://dashboard.razorpay.com)
- [ ] Navigate to Settings → API Keys
- [ ] Copy the **Test Key Secret** (the key ID `rzp_test_T6Eny4ITfuoZKL` is already set in `.env.local` — verify it matches)
- [ ] Keep the secret ready — it is needed in Task 2 and Task 3

---

### Task 1: Fix TypeScript Compilation

**Purpose:** `npx tsc --noEmit` currently fails with 10 Deno-specific errors from the Edge Function. The Edge Function file (`mei-admin/supabase/functions/create-order/index.ts`) uses `Deno.*` globals and `jsr:` imports that do not exist in the Next.js TypeScript environment. Excluding `mei-admin` from the storefront's tsconfig is the correct fix — it is not a Deno project and should never be compiled by the Next.js TS checker.

**Files:**
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `npx tsc --noEmit` exits 0

- [ ] **Step 1: Confirm the pre-existing tsc failure**

Run:
```bash
npx tsc --noEmit 2>&1 | head -5
```
Expected output (first line):
```
mei-admin/supabase/functions/create-order/index.ts(1,30): error TS2307: Cannot find module 'jsr:@supabase/supabase-js@2'
```

- [ ] **Step 2: Add `mei-admin` to tsconfig exclude**

In `tsconfig.json`, change `"exclude"` from:
```json
"exclude": ["node_modules"]
```
to:
```json
"exclude": ["node_modules", "mei-admin"]
```

- [ ] **Step 3: Verify tsc now passes**

Run:
```bash
npx tsc --noEmit
```
Expected: no output, exit code 0

- [ ] **Step 4: Verify existing tests still pass**

Run:
```bash
npm test
```
Expected:
```
Test Files  8 passed (8)
     Tests  79 passed (79)
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json
git commit -m "fix(tsconfig): exclude mei-admin Deno files from Next.js TS compilation"
```

---

### Task 2: Write API Route Tests

**Purpose:** `src/app/api/razorpay/create-order/route.ts` has zero test coverage. The testing requirement demands all tests pass, and the route has four distinct code paths that must be covered before any environment change is made.

**Files:**
- Create: `src/app/api/razorpay/create-order/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `POST` exported from `src/app/api/razorpay/create-order/route.ts`
- Produces: 6 new passing tests; total test count becomes 85

- [ ] **Step 1: Write the test file**

Create `src/app/api/razorpay/create-order/__tests__/route.test.ts` with the following content:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/razorpay/create-order", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeSupabaseClient(result: { data: unknown; error: unknown }) {
  const inFn = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select }));
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS = "false";
});

describe("POST /api/razorpay/create-order", () => {
  it("returns 400 with EMPTY_CART when items array is empty", async () => {
    const res = await POST(makeRequest({ items: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "EMPTY_CART" });
  });

  it("returns 500 with PRODUCT_LOOKUP_FAILED when Supabase query errors", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: null, error: { message: "db error" } }) as unknown as ReturnType<typeof createClient>
    );
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "PRODUCT_LOOKUP_FAILED" });
  });

  it("returns 400 with PRODUCT_NOT_FOUND when product id has no price", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [], error: null }) as unknown as ReturnType<typeof createClient>
    );
    const res = await POST(makeRequest({ items: [{ product_id: "unknown", quantity: 1 }] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "PRODUCT_NOT_FOUND" });
  });

  it("returns bypass order when NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS is true", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS", "true");
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [{ id: "p1", price: 1000 }], error: null }) as unknown as ReturnType<typeof createClient>
    );
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bypass).toBe(true);
    expect(body.razorpay_order_id).toMatch(/^bypass_/);
    expect(body.currency).toBe("INR");
    expect(typeof body.amount).toBe("number");
  });

  it("returns 502 with RAZORPAY_ORDER_FAILED when Razorpay API returns non-ok", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS", "false");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [{ id: "p1", price: 1000 }], error: null }) as unknown as ReturnType<typeof createClient>
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "Unauthorized",
    } as unknown as Response);
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "RAZORPAY_ORDER_FAILED" });
  });

  it("returns razorpay order data on success", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS", "false");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [{ id: "p1", price: 1000 }], error: null }) as unknown as ReturnType<typeof createClient>
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_abc123", amount: 100000, currency: "INR" }),
    } as unknown as Response);
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.razorpay_order_id).toBe("order_abc123");
    expect(body.amount).toBe(100000);
    expect(body.currency).toBe("INR");
    expect(body.key_id).toBe("rzp_test_key");
    expect(body.bypass).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new tests — expect all 6 to PASS**

```bash
npm test src/app/api/razorpay/create-order/__tests__/route.test.ts
```
Expected:
```
Test Files  1 passed (1)
     Tests  6 passed (6)
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```
Expected:
```
Test Files  9 passed (9)
     Tests  85 passed (85)
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/razorpay/create-order/__tests__/route.test.ts
git commit -m "test(razorpay): add full coverage for create-order API route"
```

---

### Task 3: Enable Real Payment in Storefront Environment

**Purpose:** `.env.local` has `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true` (skips modal) and a fake `RAZORPAY_KEY_SECRET` (would 401 against Razorpay). Both must be corrected for the Razorpay modal to open and for the API route to create real orders.

> **IMPORTANT:** `.env.local` is git-ignored. These changes are local-only and will not be committed. The real Razorpay test secret from your dashboard goes here.

**Files:**
- Modify: `.env.local`

**Interfaces:**
- Consumes: Real Razorpay test secret from Prerequisite step
- Produces: `/api/razorpay/create-order` returns a real Razorpay order when called

- [ ] **Step 1: Update `.env.local`**

Change lines 10 and 19 in `.env.local`:

```
# Before
RAZORPAY_KEY_SECRET=test_razorpay_key_secret_for_dev
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true

# After
RAZORPAY_KEY_SECRET=<YOUR_REAL_RAZORPAY_TEST_SECRET>
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false
```

The full updated file should look like (replacing only those two values):
```
NEXT_PUBLIC_SUPABASE_URL=https://hjhqemsyufsifmgespur.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTYzMDksImV4cCI6MjA5NjU3MjMwOX0.C3q3hCrcbdKxDmvCpEzAZ4sO3AKXXdfAVE6fq4E7M_g
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk5NjMwOSwiZXhwIjoyMDk2NTcyMzA5fQ.-FRJZIPq-hpfstKY2vZvahztAa0ZEv2-QSSpiEy591o

# WhatsApp — international format without +, e.g. 919876543210
NEXT_PUBLIC_WHATSAPP_NUMBER=919876543210
# Razorpay Test Key (safe to expose in frontend)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_T6Eny4ITfuoZKL
# Razorpay Test Secret (server-side only)
RAZORPAY_KEY_SECRET=<YOUR_REAL_RAZORPAY_TEST_SECRET>

# mei-admin base URL — server-side only, never use NEXT_PUBLIC prefix
MEI_ADMIN_API_URL=http://localhost:3001

# Shared secret between mei and mei-admin — server-side only
STOREFRONT_API_SECRET=79d77bcdad96422684d892a35a499573219a1944df9defd69d3907f06058a8b6

# Set "true" for local dev; MUST be "false" or absent in production
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false
```

- [ ] **Step 2: Restart the Next.js dev server** (env vars are loaded at startup)

Kill any running dev server and restart:
```bash
npm run dev
```

- [ ] **Step 3: Smoke test the API route directly**

In a separate terminal, run:
```bash
curl -s -X POST http://localhost:3000/api/razorpay/create-order \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product_id":"<any-valid-product-id-from-db>","quantity":1}]}' | jq .
```
Expected: response contains `razorpay_order_id` starting with `order_` (real Razorpay order), `currency: "INR"`, `key_id: "rzp_test_T6Eny4ITfuoZKL"`, and NO `bypass` field.

If you get `PRODUCT_LOOKUP_FAILED`, the product ID is wrong. Use any product ID visible in the storefront's `/shop` page.

---

### Task 4: Enable Real Payment in Edge Function Environment

**Purpose:** Even with bypass disabled in the storefront, `mei-admin/.env.local` also has `ENABLE_PAYMENT_BYPASS=true` and a placeholder secret. When the Razorpay modal succeeds and calls the Edge Function, the function will either bypass HMAC verification (wrong) or fail with missing secret. Both values must be corrected.

> **IMPORTANT:** `mei-admin/.env.local` is git-ignored. These changes are local-only and will not be committed.

**Files:**
- Modify: `mei-admin/.env.local`

**Interfaces:**
- Consumes: Real Razorpay test secret from Prerequisite step
- Produces: Edge Function verifies HMAC and writes to Supabase in production mode

- [ ] **Step 1: Update `mei-admin/.env.local`**

Change both lines:
```
# Before
ENABLE_PAYMENT_BYPASS=true
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here

# After
ENABLE_PAYMENT_BYPASS=false
RAZORPAY_KEY_SECRET=<YOUR_REAL_RAZORPAY_TEST_SECRET>
```

The full updated file:
```
ENABLE_PAYMENT_BYPASS=false
RAZORPAY_KEY_SECRET=<YOUR_REAL_RAZORPAY_TEST_SECRET>
```

---

### Task 5: Deploy Edge Function Secrets to Supabase Cloud

**Purpose:** The Edge Function runs in Supabase cloud, not locally. The `RAZORPAY_KEY_SECRET` and `ENABLE_PAYMENT_BYPASS` secrets must be set in Supabase's secret store so the deployed Edge Function has access to them. Without this step, the cloud function would either use stale secrets or fail.

**Files:**
- Shell: Supabase CLI commands (no files modified)

- [ ] **Step 1: Confirm Supabase CLI is logged in**

```bash
supabase status
```
Expected: shows project ref `hjhqemsyufsifmgespur` and no auth errors.
If not logged in: `supabase login`

- [ ] **Step 2: Link to the project (if not already linked)**

From `mei-admin/`:
```bash
cd mei-admin
supabase link --project-ref hjhqemsyufsifmgespur
```

- [ ] **Step 3: Set the production secrets**

```bash
supabase secrets set RAZORPAY_KEY_SECRET=<YOUR_REAL_RAZORPAY_TEST_SECRET>
supabase secrets set ENABLE_PAYMENT_BYPASS=false
```

- [ ] **Step 4: Verify secrets are set**

```bash
supabase secrets list
```
Expected: `RAZORPAY_KEY_SECRET` and `ENABLE_PAYMENT_BYPASS` appear in the list.

- [ ] **Step 5: Deploy the Edge Function**

```bash
supabase functions deploy create-order --no-verify-jwt
```
Expected: `Deployed create-order` with no errors.

- [ ] **Step 6: Return to repo root**

```bash
cd ..
```

---

### Task 6: Run All Tests and Lint

**Purpose:** Verify the environment changes and new test file haven't broken anything. This is the gate before runtime verification.

**Files:** No modifications

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: no errors, exit 0

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no output, exit 0

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected:
```
Test Files  9 passed (9)
     Tests  85 passed (85)
```

If any test fails: **STOP**. Do not proceed to runtime verification. Diagnose the failure.

---

### Task 7: Runtime Verification — Collect Evidence for All ACs

**Purpose:** Collect evidence for AC1–AC5 using the Razorpay test card. This is the only valid completion signal. Use Razorpay test card: `4111 1111 1111 1111`, expiry `12/25`, CVV `123`, OTP `1234 1234`.

**Files:** No modifications

**Preconditions:**
- Task 6 all passed
- Dev server is running with `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false`
- Edge Function is deployed with real secret

#### AC1: Razorpay Modal Opens

- [ ] Navigate to `http://localhost:3000/cart` — add a product if cart is empty, then proceed to checkout
- [ ] Fill in all form fields (or use the pre-filled test values)
- [ ] Click "Pay Now — ₹X,XXX"
- [ ] **Evidence required:**
  - Screenshot of the Razorpay modal visible
  - Modal shows merchant name "MEI Bridal Couture"
  - Modal shows INR currency
  - Modal shows amount matching the checkout grand total

**Status:** `NOT VERIFIED` until screenshot collected

#### AC2: Successful Payment — Order Recorded

- [ ] In the open Razorpay modal, select "Card" payment method
- [ ] Enter test card: number `4111 1111 1111 1111`, expiry `12/25`, CVV `123`
- [ ] Enter OTP `1234 1234` when prompted
- [ ] **Evidence required:**
  - Network tab shows POST to the Supabase Edge Function (`create-order`) returning 200
  - Checkout page transitions to order confirmation with an order reference number
  - In Supabase Table Editor: `orders` table contains a new row with `razorpay_order_id`, `razorpay_payment_id` (not null), `payment_status = 'paid'` (or equivalent)

**Status:** `NOT VERIFIED` until database record and confirmation page screenshot collected

#### AC3: Modal Dismissed — No Order Created

- [ ] Click "Pay Now" to open the modal
- [ ] Click the X / close button to dismiss the modal
- [ ] **Evidence required:**
  - Checkout page is still visible with form fields intact
  - Cart items still visible in order summary
  - Supabase `orders` table has no new row (compare row count before and after)

**Status:** `NOT VERIFIED` until confirmed

#### AC4: Payment Failure — Error Shown

- [ ] Click "Pay Now" to open the modal
- [ ] Use Razorpay test failure card: `4000 0000 0000 0002`
- [ ] **Evidence required:**
  - Red error message appears below the Pay Now button
  - Cart items still visible
  - Form fields still populated
  - "Pay Now" button is re-enabled (not stuck in loading state)

**Status:** `NOT VERIFIED` until screenshot collected

#### AC5: All Payment Methods Visible

- [ ] Open the Razorpay modal
- [ ] **Evidence required:** Screenshot showing all of the following tabs/options visible:
  - UPI
  - Card
  - Net Banking
  - Wallets
  - EMI
  - Pay Later

**Status:** `NOT VERIFIED` until screenshot collected

---

## Final Report Template

Fill in after Task 7 is complete:

```
ROOT CAUSE:
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true in .env.local caused /api/razorpay/create-order
to return bypass:true, causing checkout/page.tsx:164 to skip the Razorpay modal entirely.
Additionally, RAZORPAY_KEY_SECRET was a placeholder in both .env.local and
mei-admin/.env.local, and ENABLE_PAYMENT_BYPASS=true in mei-admin/.env.local would
have caused the Edge Function to skip HMAC verification even for real payments.

FILES MODIFIED:
- tsconfig.json (added "mei-admin" to exclude array)
- src/app/api/razorpay/create-order/__tests__/route.test.ts (created, 6 tests)
- .env.local (NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false, real RAZORPAY_KEY_SECRET) [not committed]
- mei-admin/.env.local (ENABLE_PAYMENT_BYPASS=false, real RAZORPAY_KEY_SECRET) [not committed]
- Supabase secrets (set RAZORPAY_KEY_SECRET, ENABLE_PAYMENT_BYPASS via CLI)

WHY CHANGE WAS NECESSARY:
tsconfig.json: pre-existing tsc failure from Deno globals in Edge Function file
tests: zero coverage existed for the API route
env vars: bypass mode prevented modal; placeholder secrets would 401 against Razorpay

UNRELATED FILES MODIFIED:
NONE

AC1: [PASS/FAIL]
Evidence: [screenshot path or description]

AC2: [PASS/FAIL]
Evidence: [network trace, DB row, confirmation page screenshot]

AC3: [PASS/FAIL]
Evidence: [confirmation that checkout page remains, DB row count unchanged]

AC4: [PASS/FAIL]
Evidence: [screenshot of error message, cart preserved]

AC5: [PASS/FAIL]
Evidence: [screenshot showing all 6 payment method tabs]

Regression Tests:
[PASS/FAIL — npm test output]

Search Modal:
PASS — not modified, existing tests pass

WhatsApp:
PASS — not modified, existing tests pass

Checkout UI:
PASS — not modified, no visual changes

FINAL STATUS:
[READY FOR DONE / NOT READY FOR DONE]
```
