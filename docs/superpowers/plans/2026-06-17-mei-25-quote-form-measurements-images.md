# MEI-25 — Quote Form: Measurements & Reference Image Upload

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the contact/quote form to collect optional body measurements (6 fields → JSONB) and up to 5 reference images (client-side only — storage deferred), with full file validation and clean success reset.

**Architecture:** `measurements` and `reference_images` JSONB columns are added to the `enquiries` table and typed through `database.ts → enquiries.ts → actions.ts`. Measurements flow end-to-end to Supabase on submit. Image files stay in React state; `referenceImages: null` is submitted until the Supabase Storage story lands. Image validation (MIME type, 5 MB limit, duplicates) is enforced client-side before files reach the state array.

**Tech Stack:** Next.js App Router (client component + "use server" action), Supabase JS, Vitest, TypeScript, Tailwind CSS.

> **Supersedes:** `2026-06-17-mei-16-25-quote-form-measurements-images.md` (earlier draft — use this one).

---

## File Map

| File | Change |
|---|---|
| `src/lib/supabase/database.ts` | Add `measurements: Json \| null` and `reference_images: Json \| null` to enquiries Row / Insert / Update |
| `src/lib/services/enquiries.ts` | Export `EnquiryMeasurements`; add `measurements` + `referenceImages` to `CreateEnquiryInput`; pass both to insert row |
| `src/lib/services/__tests__/enquiries.test.ts` | 4 new tests: measurements passthrough, null measurements, referenceImages passthrough, null referenceImages |
| `src/app/contact/__tests__/actions.test.ts` | 2 new tests: action forwards measurements, action forwards referenceImages |
| `src/app/contact/page.tsx` | Add measurements state + UI; add imageFiles state + validation + upload UI; update handleSubmit; update success reset |

`src/app/contact/actions.ts` needs **no changes** — it passes `data: CreateEnquiryInput` directly to `createEnquiry(data)`.

---

## Task 0: Schema Verification and Migration

No code files change in this task. We check whether the two new columns exist in Supabase and apply migrations only if they're missing.

**Files:** None — SQL only.

- [ ] **Step 1: Check existing enquiries columns**

Run this in the Supabase Dashboard → SQL Editor (or via `psql`):

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'enquiries'
ORDER BY ordinal_position;
```

Expected columns include at minimum: `id`, `name`, `email`, `phone`, `occasion`, `budget`, `message`, `status`, `admin_reply`, `replied_at`, `replied_by`, `created_at`.

- [ ] **Step 2: Add `measurements` if missing**

If `measurements` is NOT in the results above, run:

```sql
ALTER TABLE public.enquiries
ADD COLUMN measurements JSONB;
```

If it already exists, skip this step.

- [ ] **Step 3: Add `reference_images` if missing**

If `reference_images` is NOT in the results above, run:

```sql
ALTER TABLE public.enquiries
ADD COLUMN reference_images JSONB;
```

`reference_images` will store a JSON array of URL strings: `["https://…/img1.jpg", "https://…/img2.jpg"]`. If it already exists, skip this step.

- [ ] **Step 4: Verify both columns exist**

Re-run the SELECT from Step 1 and confirm `measurements` and `reference_images` appear in the output.

---

## Task 1: Extend enquiry data layer — DB types, service, tests

**Files:**
- Modify: `src/lib/supabase/database.ts:47-51`
- Modify: `src/lib/services/enquiries.ts`
- Modify: `src/lib/services/__tests__/enquiries.test.ts`
- Modify: `src/app/contact/__tests__/actions.test.ts`

- [ ] **Step 1: Write the 4 failing service tests**

Open `src/lib/services/__tests__/enquiries.test.ts`. Append these 4 tests **inside** the existing `describe("createEnquiry", ...)` block, after the last `it(...)`:

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

  it("passes reference_images through to insert when referenceImages provided", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    const referenceImages = ["https://example.com/img1.jpg", "https://example.com/img2.jpg"];
    await createEnquiry({ ...validInput, referenceImages });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reference_images: referenceImages })
    );
  });

  it("passes null reference_images when referenceImages not provided", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    await createEnquiry(validInput);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reference_images: null })
    );
  });
```

- [ ] **Step 2: Write the 2 failing action tests**

Open `src/app/contact/__tests__/actions.test.ts`. Append these 2 tests inside the existing `describe("submitEnquiry", ...)` block:

```typescript
  it("forwards measurements to createEnquiry when provided", async () => {
    vi.mocked(createEnquiry).mockResolvedValue(undefined);
    const measurements = { bust: "34in", waist: "26in" };

    const result = await submitEnquiry({ ...validData, measurements });

    expect(result).toEqual({ success: true });
    expect(createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ measurements }));
  });

  it("forwards referenceImages to createEnquiry when provided", async () => {
    vi.mocked(createEnquiry).mockResolvedValue(undefined);
    const referenceImages = ["https://example.com/img1.jpg"];

    const result = await submitEnquiry({ ...validData, referenceImages });

    expect(result).toEqual({ success: true });
    expect(createEnquiry).toHaveBeenCalledWith(expect.objectContaining({ referenceImages }));
  });
```

- [ ] **Step 3: Run all tests to confirm the 6 new ones fail**

```bash
npx vitest run
```

Expected: the 6 new tests FAIL (type/property errors or assertion failures). All existing tests (3 service + 8 action = 11) pass.

- [ ] **Step 4: Update DB types**

In `src/lib/supabase/database.ts`, replace the `enquiries` block (lines 47–51) with:

```typescript
      enquiries: {
        Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; measurements: Json | null; reference_images: Json | null; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
        Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; measurements?: Json | null; reference_images?: Json | null; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
        Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null; measurements?: Json | null; reference_images?: Json | null }
      }
```

- [ ] **Step 5: Replace the enquiry service**

Replace `src/lib/services/enquiries.ts` entirely:

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
  referenceImages?: string[] | null;
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
    reference_images: input.referenceImages ?? null,
    status: "NEW",
  };

  const { error } = await supabase.from("enquiries").insert(row) as SupabaseClient;

  if (error) {
    console.error("[EnquiriesService:createEnquiry]", error);
    throw error;
  }
}
```

- [ ] **Step 6: Run all tests — all 17 should pass**

```bash
npx vitest run
```

Expected: 17 tests pass (3 original service + 4 new service + 8 original action + 2 new action).

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/database.ts src/lib/services/enquiries.ts src/lib/services/__tests__/enquiries.test.ts src/app/contact/__tests__/actions.test.ts
git commit -m "feat(enquiries): add measurements and reference_images JSONB fields to service and DB types"
```

---

## Task 2: Measurements UI + submit wiring + success reset

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Add measurements state and handler**

In `src/app/contact/page.tsx`, after line 21 (`const [submitError, setSubmitError] = useState<string | null>(null);`), add:

```typescript
  const [measurements, setMeasurements] = useState({
    bust: "", waist: "", hip: "", shoulder: "", length: "", sleeve: "",
  });

  const handleMeasurementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.id as keyof typeof measurements;
    setMeasurements(prev => ({ ...prev, [field]: e.target.value }));
  };
```

- [ ] **Step 2: Replace `handleSubmit` with the updated version**

Replace lines 54–71 (the entire `handleSubmit` function) with:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

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

    // TODO(MEI-Storage): Upload imageFiles to Supabase Storage and pass returned URLs as referenceImages
    const result = await submitEnquiry({
      ...formData,
      measurements: measurementsToSubmit,
      referenceImages: null,
    });

    setIsSubmitting(false);

    if (result.success) {
      setFormData({ name: "", email: "", phone: "", occasion: "", budget: "", message: "" });
      setMeasurements({ bust: "", waist: "", hip: "", shoulder: "", length: "", sleeve: "" });
      setSubmitError(null);
      setSubmitted(true);
    } else {
      setSubmitError(result.error);
    }
  };
```

- [ ] **Step 3: Add the measurements UI section**

In `src/app/contact/page.tsx`, after the closing `</div>` of the Message textarea section (after line 254, before the `{submitError &&` block), insert:

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

Expected: zero errors.

- [ ] **Step 5: Run tests**

```bash
npx vitest run
```

Expected: all 17 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat(contact): add optional measurements section to quote form"
```

---

## Task 3: Image Upload UI with file validation

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Add `useRef` and `useEffect` to the React import**

Replace line 3:

```typescript
import { useState } from "react";
```

with:

```typescript
import { useState, useRef, useEffect } from "react";
```

- [ ] **Step 2: Add image file state, constants, ref, effect, and handlers**

In `src/app/contact/page.tsx`, after the `handleMeasurementChange` function added in Task 2, add:

```typescript
  const MAX_IMAGES = 5;
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    const urls = imageFiles.map(f => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => { urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [imageFiles]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = "";
    setImageError(null);

    if (incoming.length === 0) return;

    const invalidType = incoming.find(f => !ALLOWED_TYPES.includes(f.type));
    if (invalidType) {
      setImageError(`"${invalidType.name}" is not allowed. Use JPEG, PNG, or WebP.`);
      return;
    }

    const tooLarge = incoming.find(f => f.size > MAX_SIZE_BYTES);
    if (tooLarge) {
      setImageError(`"${tooLarge.name}" exceeds the 5 MB limit.`);
      return;
    }

    const unique = incoming.filter(
      f => !imageFiles.some(
        p => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified
      )
    );

    if (unique.length < incoming.length) {
      setImageError("One or more images were already added and were skipped.");
    }

    if (unique.length === 0) return;

    const combined = [...imageFiles, ...unique];
    if (combined.length > MAX_IMAGES) {
      setImageError(`You can add a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    setImageFiles(combined);
  };

  const removeImage = (index: number) => {
    setImageError(null);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };
```

- [ ] **Step 3: Update success reset in `handleSubmit` to clear image state**

Inside `handleSubmit`, find the `if (result.success)` block (added in Task 2) and add the two image resets so it reads:

```typescript
    if (result.success) {
      setFormData({ name: "", email: "", phone: "", occasion: "", budget: "", message: "" });
      setMeasurements({ bust: "", waist: "", hip: "", shoulder: "", length: "", sleeve: "" });
      setImageFiles([]);
      setImageError(null);
      setSubmitError(null);
      setSubmitted(true);
    }
```

- [ ] **Step 4: Add the image upload UI section**

After the closing `</div>` of the Measurements section (added in Task 2) and before the `{submitError &&` block, insert:

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
                JPEG, PNG, or WebP only · Maximum size: 5 MB per image
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleImageChange}
            />

            {imageFiles.length < MAX_IMAGES ? (
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
                Select Images ({imageFiles.length}/{MAX_IMAGES})
              </button>
            ) : (
              <p className="text-xs text-[#9a9a9a]/60">
                Maximum 5 images reached. Remove an image to change your selection.
              </p>
            )}

            {imageError && (
              <p role="alert" className="text-xs text-red-500">{imageError}</p>
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

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: zero errors. If the `@next/next/no-img-element` ESLint rule fires despite the `eslint-disable-next-line` comment above the `<img>` tag, confirm the comment is on the line immediately before `<img`.

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: all 17 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat(contact): add reference image upload UI with MIME/size/duplicate validation (storage deferred)"
```

---

## Task 4: Quality Gates and Manual QA

**Files:** None — verification only.

- [ ] **Step 1: All automated checks must be green**

```bash
npx vitest run
```
Expected output contains: `17 passed`.

```bash
npm run lint
```
Expected: exits with code 0, zero errors or warnings.

```bash
npx tsc --noEmit
```
Expected: exits with code 0, no output.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Navigate to `http://localhost:3000/contact`.

- [ ] **Step 3: QA — no measurements, submit**

Fill name, email (+91 format), phone, occasion, budget, message. Leave measurements blank. Submit.

Expected: "Inquiry Received" success screen appears. Check Supabase Dashboard → Table Editor → enquiries → newest row: `measurements` column is `null`.

- [ ] **Step 4: QA — partial measurements**

Reload. Fill required fields. Enter only Bust = `34"` and Waist = `26"`. Submit.

Expected: success screen. In Supabase, newest row `measurements` = `{"bust": "34\"", "waist": "26\"", "hip": null, "shoulder": null, "length": null, "sleeve": null}`.

- [ ] **Step 5: QA — full measurements**

Reload. Fill all 6 measurement fields. Submit.

Expected: success screen. `measurements` JSONB in Supabase contains all 6 keys with non-null values.

- [ ] **Step 6: QA — image upload (1 image)**

Reload. Click "Select Images (0/5)". Pick a JPEG. Expect: thumbnail appears in the grid. Button changes to "Select Images (1/5)".

- [ ] **Step 7: QA — image upload (5 images)**

Continue adding 4 more images (total 5). Expect: button disappears and is replaced by "Maximum 5 images reached." message. No error shown.

- [ ] **Step 8: QA — remove an image**

Hover over a thumbnail. Click the × button. Expect: image removed, "Select Images (4/5)" button reappears.

- [ ] **Step 9: QA — file type rejection**

Click Select Images. Pick a PDF or a ZIP file. Expected: error message `"filename.pdf" is not allowed. Use JPEG, PNG, or WebP.` No file is added to the grid.

- [ ] **Step 10: QA — file size rejection**

Attempt to upload an image over 5 MB. Expected: error message `"filename.jpg" exceeds the 5 MB limit.` No file is added.

- [ ] **Step 11: QA — duplicate rejection**

Add an image. Click Select Images again and pick the exact same file. Expected: error message `"One or more images were already added and were skipped."` Count stays the same.

- [ ] **Step 12: QA — success flow resets image state**

Add 2 images. Fill required fields. Submit. Expected: "Inquiry Received" screen. All image previews, measurements fields, and form fields are cleared in state (will be empty if user navigates back). `reference_images` in Supabase is `null` for this row (storage not yet integrated).

- [ ] **Step 13: Confirm no admin regressions**

Navigate to the admin panel. Open the enquiries list. Verify the NEW / REPLIED / CLOSED filters still work and enquiries display correctly.

- [ ] **Step 14: Confirm no storefront regressions**

Check homepage, a collection page, and a product detail page load without errors.

- [ ] **Mark MEI-25 READY FOR QA** ✅

Only once all of Steps 1–14 above pass.

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Optional measurements: bust, waist, hip, shoulder, length, sleeve | Task 2 |
| Reference image upload — up to 5 images | Task 3 |
| Measurements submit alongside enquiry | Task 2 (handleSubmit wires measurementsToSubmit) |
| Images submit alongside enquiry | Deferred per tech note — `referenceImages: null` sent, column ready in DB; TODO marker added |
| Measurements → `enquiries.measurements` JSONB | Task 0 (migration) + Task 1 (service) |
| Images → Supabase Storage (wire when integration lands) | Task 3 (UI only, TODO comment) |
| JPEG/PNG/WebP only | Task 3 (ALLOWED_TYPES + handleImageChange) |
| 5 MB limit per image | Task 3 (MAX_SIZE_BYTES + handleImageChange) |
| Duplicate protection (name + size + lastModified) | Task 3 (handleImageChange unique filter) |
| Revoke object URLs — no memory leaks | Task 3 (useEffect cleanup) |
| Success reset: formData, measurements, imageFiles, imagePreviews, submitError | Task 3 (handleSubmit if block) |
| Phase 0 schema verification | Task 0 |
| Quality gates: tests, lint, tsc | Task 4 |
| No regressions: admin, storefront | Task 4 Step 13–14 |

**Placeholder scan:** None.

**Type consistency:**
- `EnquiryMeasurements` defined in Task 1 (`enquiries.ts`), used implicitly via `CreateEnquiryInput.measurements` in Task 2 (`page.tsx` — `measurementsToSubmit` satisfies `EnquiryMeasurements | null`).
- `measurements[field]` in the render loop is type-safe: `field` is `keyof typeof measurements` via `as const`.
- `reference_images` (DB snake_case) ↔ `referenceImages` (TS camelCase) mapping is explicit in the service `row` object.
- `imageFiles` is `File[]`; `imagePreviews` is `string[]`; `imageError` is `string | null` — all consistent through Task 3.
