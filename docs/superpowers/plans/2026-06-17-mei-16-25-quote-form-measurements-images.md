# Quote Form — Measurements & Reference Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the contact/quote form to collect optional body measurements and up to 5 reference images, with measurements stored as JSONB and image upload deferred until Supabase Storage integration lands.

**Architecture:** Measurements are added to `CreateEnquiryInput` and flow through the server action → service → Supabase insert as a JSONB column. Image files are held in React state client-side only (deferred upload); the UI is built now so the customer experience is complete. No changes to form validation rules — both fields are optional.

**Tech Stack:** Next.js App Router (client component + "use server" action), Vitest, TypeScript, Tailwind CSS, Supabase (JS client).

---

## File Map

| File | Change |
|---|---|
| `src/lib/supabase/database.ts` | Add `measurements: Json \| null` to enquiries Row / Insert / Update |
| `src/lib/services/enquiries.ts` | Export `EnquiryMeasurements` interface; add `measurements` to `CreateEnquiryInput`; pass to insert |
| `src/lib/services/__tests__/enquiries.test.ts` | Add 2 tests: measurements passthrough + null when omitted |
| `src/app/contact/__tests__/actions.test.ts` | Add 1 test: action forwards measurements to `createEnquiry` |
| `src/app/contact/page.tsx` | Add measurements state + UI; add imageFiles state + upload UI |

> `src/app/contact/actions.ts` needs **no changes** — it already calls `createEnquiry(data)` which passes the whole input object, so extending the type is enough.

---

## Task 1: Extend enquiry data layer with `measurements` field

**Files:**
- Modify: `src/lib/supabase/database.ts:47-51`
- Modify: `src/lib/services/enquiries.ts`
- Modify: `src/lib/services/__tests__/enquiries.test.ts`
- Modify: `src/app/contact/__tests__/actions.test.ts`

- [ ] **Step 1: Write the two failing service tests**

Open `src/lib/services/__tests__/enquiries.test.ts`. Add these two tests inside the existing `describe("createEnquiry", ...)` block, after the last `it(...)`:

```typescript
it("passes measurements through to insert when provided", async () => {
  const chain = makeInsertChain({ error: null });
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

  const measurements = { bust: "34in", waist: "26in", hip: "36in", shoulder: "14in", length: "42in", sleeve: "24in" };
  await createEnquiry({ ...validInput, measurements });

  expect(chain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ measurements })
  );
});

it("passes null measurements when not provided", async () => {
  const chain = makeInsertChain({ error: null });
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

  await createEnquiry(validInput);

  expect(chain.insert).toHaveBeenCalledWith(
    expect.objectContaining({ measurements: null })
  );
});
```

- [ ] **Step 2: Run service tests to verify they fail**

```bash
npx vitest run src/lib/services/__tests__/enquiries.test.ts
```

Expected: the two new tests FAIL with `"Property 'measurements' does not exist"` or `"Expected ... to contain { measurements: ... }"`. Existing 3 tests pass.

- [ ] **Step 3: Write the failing action test**

Open `src/app/contact/__tests__/actions.test.ts`. Add this test inside the existing `describe("submitEnquiry", ...)` block after the last `it(...)`:

```typescript
it("forwards measurements to createEnquiry when provided", async () => {
  vi.mocked(createEnquiry).mockResolvedValue(undefined);
  const measurements = { bust: "34in", waist: "26in" };

  const result = await submitEnquiry({ ...validData, measurements });

  expect(result).toEqual({ success: true });
  expect(createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ measurements }));
});
```

- [ ] **Step 4: Run action tests to verify the new one fails**

```bash
npx vitest run src/app/contact/__tests__/actions.test.ts
```

Expected: the new test FAILS. Existing 8 tests pass.

- [ ] **Step 5: Add `measurements` to the DB type**

In `src/lib/supabase/database.ts`, replace the `enquiries` block (lines 47–51) with:

```typescript
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; measurements: Json | null; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
        Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; measurements?: Json | null; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null; measurements?: Json | null }
      }
```

- [ ] **Step 6: Extend the enquiry service**

Replace `src/lib/services/enquiries.ts` entirely with:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

export interface EnquiryMeasurements {
  bust?: string | null;
  waist?: string | null;
  hip?: string | null;
  shoulder?: string | null;
  length?: string | null;
  sleeve?: string | null;
}

export interface CreateEnquiryInput {
  name: string;
  email: string;
  phone: string;
  occasion: string;
  budget: string;
  message: string;
  measurements?: EnquiryMeasurements | null;
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function createEnquiry(input: CreateEnquiryInput): Promise<void> {
  const supabase = getServiceClient() as SupabaseClient;

  const row: SupabaseClient = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim() || null,
    occasion: input.occasion.trim() || null,
    budget: input.budget.trim() || null,
    message: input.message.trim(),
    measurements: input.measurements ?? null,
    status: "NEW",
  };

  const { error } = await supabase.from("enquiries").insert(row) as SupabaseClient;

  if (error) {
    console.error("[EnquiriesService:createEnquiry]", error);
    throw error;
  }
}
```

- [ ] **Step 7: Run all tests to verify they pass**

```bash
npx vitest run
```

Expected: all tests PASS (3 original service tests + 2 new service tests + 8 original action tests + 1 new action test = 14 total).

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase/database.ts src/lib/services/enquiries.ts src/lib/services/__tests__/enquiries.test.ts src/app/contact/__tests__/actions.test.ts
git commit -m "feat(enquiries): add measurements JSONB field to CreateEnquiryInput and service layer"
```

---

## Task 2: Add measurements section to the contact form UI

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Add measurements state and handler**

In `src/app/contact/page.tsx`, after the `const [submitError, setSubmitError] = useState<string | null>(null);` line (line 21), add:

```typescript
  const [measurements, setMeasurements] = useState({
    bust: "", waist: "", hip: "", shoulder: "", length: "", sleeve: "",
  });

  const handleMeasurementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.id as keyof typeof measurements;
    setMeasurements(prev => ({ ...prev, [field]: e.target.value }));
  };
```

- [ ] **Step 2: Update `handleSubmit` to pass measurements**

Replace the single `const result = await submitEnquiry(formData);` line (line 62) with:

```typescript
    const hasMeasurements = Object.values(measurements).some(v => v.trim());
    const measurementsToSubmit = hasMeasurements
      ? {
          bust: measurements.bust.trim() || null,
          waist: measurements.waist.trim() || null,
          hip: measurements.hip.trim() || null,
          shoulder: measurements.shoulder.trim() || null,
          length: measurements.length.trim() || null,
          sleeve: measurements.sleeve.trim() || null,
        }
      : null;

    const result = await submitEnquiry({ ...formData, measurements: measurementsToSubmit });
```

- [ ] **Step 3: Add the measurements UI section**

In `src/app/contact/page.tsx`, after the closing `</div>` of the Message section (after line 254) and before the `{submitError && ...}` block, insert:

```tsx
          {/* Measurements Section */}
          <div className="space-y-4 border-t border-[#e8e0d5] pt-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                Measurements{" "}
                <span className="font-normal normal-case tracking-normal text-[#9a9a9a]/60">
                  (Optional — all in inches)
                </span>
              </p>
              <p className="text-xs text-[#9a9a9a]/60 mt-1">
                Providing measurements helps us quote accurately and speeds up the fitting process.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(["bust", "waist", "hip", "shoulder", "length", "sleeve"] as const).map((field) => (
                <div key={field} className="space-y-1.5">
                  <label
                    htmlFor={field}
                    className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9a9a]"
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    type="text"
                    id={field}
                    placeholder='e.g. 34"'
                    value={measurements[field]}
                    onChange={handleMeasurementChange}
                    className="w-full border border-[#e8e0d5] bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a]/40 focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run tests to confirm nothing broke**

```bash
npx vitest run
```

Expected: all 14 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat(contact): add optional measurements section to quote form"
```

---

## Task 3: Add reference image upload UI (client-side only — deferred storage)

Images are selected and previewed client-side. They are **not sent to the server** in this story; the upload wire-up waits for the Supabase Storage integration.

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Add `useRef` and `useEffect` to the React import**

Replace line 3 in `src/app/contact/page.tsx`:
```typescript
import { useState } from "react";
```
with:
```typescript
import { useState, useRef, useEffect } from "react";
```

- [ ] **Step 2: Add image file state, ref, and preview effect**

After the `handleMeasurementChange` handler added in Task 2, add:

```typescript
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = imageFiles.map(f => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [imageFiles]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    setImageFiles(prev => [...prev, ...incoming].slice(0, 5));
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };
```

- [ ] **Step 3: Add the image upload UI section**

After the closing `</div>` of the Measurements section added in Task 2 (and still before the `{submitError && ...}` block), insert:

```tsx
          {/* Reference Images */}
          <div className="space-y-4 border-t border-[#e8e0d5] pt-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                Reference Images{" "}
                <span className="font-normal normal-case tracking-normal text-[#9a9a9a]/60">
                  (Optional — up to 5)
                </span>
              </p>
              <p className="text-xs text-[#9a9a9a]/60 mt-1">
                Share inspiration photos or previous outfits to help us understand your vision.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageChange}
            />

            {imageFiles.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 border border-dashed border-[#c9a465] px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#c9a465] hover:bg-[#c9a465]/5 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                Select Images ({imageFiles.length}/5)
              </button>
            )}

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {imagePreviews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square border border-[#e8e0d5] overflow-hidden group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Reference ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove image ${i + 1}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="white"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all 14 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat(contact): add reference image upload UI to quote form (client-side, storage deferred)"
```

---

## Self-Review

**Spec coverage:**

| AC | Task |
|---|---|
| Optional measurements: bust, waist, hip, shoulder, length, sleeve | Task 2 |
| Reference image upload — up to 5 images | Task 3 |
| Both submit alongside the rest of the enquiry | Measurements: Task 1+2 submit via service. Images: deferred per tech note — UI is complete, wire-up lands in storage integration story |
| Measurements map to `enquiries.measurements` JSONB | Task 1 (DB type + service) |
| Images go to Supabase Storage (wire when integration lands) | Task 3 UI only — explicitly deferred |

**Placeholder scan:** None. All code blocks are complete.

**Type consistency:**
- `EnquiryMeasurements` defined in Task 1 `enquiries.ts`, used in Task 2 `page.tsx` via the extended `CreateEnquiryInput`.
- `measurementsToSubmit` type (`{ bust: string | null; ... } | null`) satisfies `EnquiryMeasurements | null`.
- `measurements[field]` in the render loop is valid because `field` is typed as `keyof typeof measurements` via the `as const` array.
