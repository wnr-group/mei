# Storefront Supabase Images — Pre-Implementation Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify that the mapper functions pass Supabase Storage URLs through unmodified, add regression tests for that contract, and confirm the full `/images/` audit so the main implementation plan (`2026-06-17-storefront-supabase-images.md`) has no surprises.

**Architecture:** Both mappers (`_mapDbRowToProduct`, `_mapDbRowToCategory`) copy `row.image_url` to the view-model with `image_url: row.image_url` — no transform. Regression tests pin this contract. The `/images/` grep identifies every local-asset reference; all but one (`page.tsx:67` — the category fallback) are static editorial images that are intentionally hardcoded.

**Tech Stack:** Vitest, TypeScript

---

## File Map

| File | Change |
|---|---|
| `src/lib/services/__tests__/products.test.ts` | Add regression test: Supabase Storage URL is preserved in both `image_url` and `images[]` |
| `src/lib/services/__tests__/categories.test.ts` | Add regression test: Supabase Storage URL is preserved in `image_url` |

---

### Task 1: Pin Supabase URL passthrough in product mapper

**Files:**
- Modify: `src/lib/services/__tests__/products.test.ts`

The mapper does `image_url: row.image_url` with no transform. This test pins that contract so a future refactor cannot silently strip or rewrite the URL.

- [ ] **Step 1: Add the regression test**

Open `src/lib/services/__tests__/products.test.ts`. Inside the existing `describe("_mapDbRowToProduct", ...)` block (after the last `it(...)` — currently around line 85), add the following two tests:

```ts
  it("preserves Supabase image_url values", () => {
    const url =
      "https://example.supabase.co/storage/v1/object/public/product-images/test.jpg";

    const p = _mapDbRowToProduct(
      baseRow({
        product_media: [],
        image_url: url,
      })
    );

    expect(p.image_url).toBe(url);
    expect(p.images).toEqual([url]);
  });

  it("returns empty images array when product_media is empty and image_url is null", () => {
    const p = _mapDbRowToProduct(
      baseRow({ product_media: [], image_url: null })
    );
    expect(p.images).toEqual([]);
    expect(p.image_url).toBeNull();
  });
```

- [ ] **Step 2: Run tests — both new tests must pass**

```
npm test
```

Expected output: all tests pass. The mapper already handles both cases; these tests are regression guards.

If any test fails, stop and investigate the mapper in `src/lib/services/products.ts` before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/__tests__/products.test.ts
git commit -m "test: pin Supabase URL passthrough in _mapDbRowToProduct"
```

---

### Task 2: Pin Supabase URL passthrough in category mapper

**Files:**
- Modify: `src/lib/services/__tests__/categories.test.ts`

The category mapper does `image_url: row.image_url` — same contract, same risk. The existing test at line 34 uses a relative-path URL (`/img/lehengas.png`). This test adds a Supabase Storage URL to pin that full URLs survive unchanged.

- [ ] **Step 1: Add the regression test**

Open `src/lib/services/__tests__/categories.test.ts`. Inside the existing `describe("_mapDbRowToCategory", ...)` block (after the last `it(...)` — currently around line 64), add:

```ts
  it("preserves Supabase image_url values", () => {
    const url =
      "https://example.supabase.co/storage/v1/object/public/category-images/lehengas.jpg";

    const cat = _mapDbRowToCategory(
      baseRow({ image_url: url })
    );

    expect(cat.image_url).toBe(url);
  });
```

- [ ] **Step 2: Run tests — new test must pass**

```
npm test
```

Expected output: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/__tests__/categories.test.ts
git commit -m "test: pin Supabase URL passthrough in _mapDbRowToCategory"
```

---

### Task 3: Audit `/images/` references — confirm scope

**Files:**
- No code changes — verification only

Run the full search and classify every hit against the table below before starting the main implementation plan.

- [ ] **Step 1: Run the grep**

```
npx grep-cli "/images/" src --include="*.tsx" --include="*.ts" -rn
```

Or using ripgrep if available:

```
rg "/images/" src/ -n
```

- [ ] **Step 2: Verify the results match this classification**

Expected hits and their classification:

| File | Line | Value | Classification |
|---|---|---|---|
| `src/app/page.tsx` | 21 | `/images/hero_lehenga.png` | Static editorial hero banner — **intentional, no change** |
| `src/app/page.tsx` | 67 | `cat.image_url ?? "/images/rose_lehenga.png"` | Shopper-facing category fallback — **addressed in main plan Task 3** |
| `src/app/atelier/page.tsx` | 11 | `/images/hero_lehenga.png` | Atelier page editorial hero — **intentional, no change** |
| `src/app/atelier/page.tsx` | 53, 165, 174, 183, 192 | Various `/images/*.png` | Atelier philosophy/portfolio editorial imagery — **intentional, no change** |
| `src/app/contact/page.tsx` | 368, 382, 392, 404 | Various `/images/*.png` | Contact page "Editorial Image Mosaic Grid" — **intentional, no change** |
| `src/lib/data/mockProducts.ts` | Many | `/images/*.png` | Orphaned mock data file (zero imports anywhere) — **no production impact** |

If any shopper-facing product or category image path uses a `/images/` fallback that is **not** in this table, add a task to the main plan before proceeding.

- [ ] **Step 3: Confirm `mockProducts.ts` is not imported**

```
rg "mockProducts" src/
```

Expected output: no matches. The file is orphaned and safe to ignore (or delete in a future cleanup).

- [ ] **Step 4: Record findings and continue to main plan**

If the audit matches the table above exactly:

```bash
git commit --allow-empty -m "chore: pre-implementation audit complete — only page.tsx:67 is an actionable local-asset fallback"
```

Then proceed to `docs/superpowers/plans/2026-06-17-storefront-supabase-images.md`.

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Verify `_mapDbRowToProduct` returns full Supabase Storage URL in `image_url` | Task 1 (regression test proves it) |
| Verify `_mapDbRowToCategory` returns full Supabase Storage URL in `image_url` | Task 2 (regression test proves it) |
| Add regression test preserving Supabase image URLs | Task 1 (products) + Task 2 (categories) |
| Search storefront for `/images/` and confirm all shopper-facing paths use DB URLs | Task 3 |

**Placeholder scan:** No TBD/TODO/placeholder language. All test code is complete and runnable.

**Type consistency:** `baseRow()` and `_mapDbRowToProduct` / `_mapDbRowToCategory` are defined in the existing test files and used consistently.
