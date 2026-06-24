# MEI-34 Slug Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix product-detail 404s for products whose DB slugs contain spaces by URL-decoding the route param before Supabase lookup — one file, three call-site changes, no service or schema modifications.

**Architecture:** Next.js 16 does NOT automatically decode `params.slug`, so `%20` arrives literally. The DB slug stores `"Designer Sarees"` (with space). Adding `decodeURIComponent` at the page-param extraction point in `src/app/shop/[slug]/page.tsx` is both necessary and sufficient. All service functions, mappers, and schema remain untouched.

**Tech Stack:** TypeScript, Next.js 16 App Router (RSC), Supabase JS client, Vitest

---

## Root-Cause Summary

| Step | Value |
|------|-------|
| URL in browser | `/shop/Designer%20Sarees` |
| `params.slug` received by page | `"Designer%20Sarees"` (NOT decoded by Next.js 16) |
| Supabase query before fix | `.eq("slug", "Designer%20Sarees")` |
| DB slug | `"Designer Sarees"` (space, original case) |
| Result | no match → `notFound()` → 404 |

Working products (`luxury-lehengas`, `royal-bridal-lehenga-2`) already have normalized slugs — `decodeURIComponent("luxury-lehengas")` is identity — so the fix is safe for those routes.

---

## STOP Conditions

**Stop immediately and do not proceed if:**

- Any currently-working product route starts returning non-200
- Any category page stops rendering
- Any Supabase image gains a new network 404/500
- The no-image placeholder disappears from `qa-no-image-product`
- Any new console error appears after the fix (LCP warnings are pre-existing and allowed)
- `npm test` fails
- `npm run build` fails

Revert with: `git checkout -- src/app/shop/\[slug\]/page.tsx src/lib/services/products.ts`

---

## Files Touched

| Action | Path | What changes |
|--------|------|-------------|
| Modify | `src/app/shop/[slug]/page.tsx` | Add `normalizedSlug` from `decodeURIComponent`; use it for all three lookups |
| Modify | `src/lib/services/products.ts` | Remove TRACE console.logs (cleanup only — no logic change) |

No other files change.

---

### Task 0: Root-Cause Verification Gate (no code changes)

**Files:** Read-only observation.

The existing `[TRACE]` logs already in `page.tsx:24,26` and `products.ts:141,151,217` will expose the exact slugs flowing through the system. This is the "red" phase — confirm the bug before touching code.

- [ ] **Step 1: Start the dev server**

```powershell
npm run dev
```

Wait for `▲ Next.js 16.x.x` and `✓ Ready` to appear in the terminal before continuing.

- [ ] **Step 2: Navigate to the broken URL and observe terminal output**

Open in browser: `http://localhost:3000/shop/Designer%20Sarees`

Expected browser output: Next.js 404 page.

Expected terminal output (the existing TRACE logs will print):

```
[TRACE] ProductDetailPage - params.slug: {"slug":"Designer%20Sarees"}
[TRACE] getProductBySlug - received slug: {"slug":"Designer%20Sarees","slugLength":17,...}
[TRACE] _cachedGetProductBySlug - input slug: {"slug":"Designer%20Sarees"}
[TRACE] _cachedGetProductBySlug - Supabase response: {"data":null,"error":null}
[TRACE] ProductDetailPage - product is null, trying getCategoryBySlug with slug: {"slug":"Designer%20Sarees"}
[TRACE] ProductDetailPage - getCategoryBySlug result: {"category":null}
[TRACE] ProductDetailPage - CALLING notFound() for slug: {"slug":"Designer%20Sarees"}
```

**Decision gate:**
- If `params.slug` shows `"Designer%20Sarees"` (percent-encoded) → **proceed to Task 1**
- If `params.slug` shows `"Designer Sarees"` (decoded space) → **STOP**. Next.js decoded it automatically; the root cause is different. Investigate the DB slug value and `status` filter instead.

- [ ] **Step 3: Confirm working slugs are unaffected**

Open: `http://localhost:3000/shop/luxury-lehengas`

Expected: 200, product page renders, terminal shows:

```
[TRACE] ProductDetailPage - params.slug: {"slug":"luxury-lehengas"}
[TRACE] _cachedGetProductBySlug - Supabase response: {"data":{...},"error":null}
```

- [ ] **Step 4: Stop the dev server**

`Ctrl+C` in the dev server terminal.

---

### Task 1: Apply the Surgical Fix

**Files:**
- Modify: `src/app/shop/[slug]/page.tsx`

The only change is adding `const normalizedSlug = decodeURIComponent(slug)` after params extraction and substituting `normalizedSlug` for `slug` at the three call sites.

- [ ] **Step 1: Read the current file to verify line numbers**

Open `src/app/shop/[slug]/page.tsx` and confirm:

- Line 23: `const { slug } = await params;`
- Line 25: `const product = await getProductBySlug(slug);`
- Line 126: `const category = await getCategoryBySlug(slug);`
- Line 130: `const products = await getProductsByCategory(slug);`

If these lines have shifted, update the edits below accordingly.

- [ ] **Step 2: Add `normalizedSlug` after params extraction**

Find this block (lines 22–25):

```typescript
export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  console.log("[TRACE] ProductDetailPage - params.slug:", JSON.stringify({ slug }));
  const product = await getProductBySlug(slug);
```

Replace with:

```typescript
export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug);
  console.log("[TRACE] ProductDetailPage - params.slug:", JSON.stringify({ slug }));
  const product = await getProductBySlug(normalizedSlug);
```

- [ ] **Step 3: Update the category and products call sites**

Find this block (lines 125–130):

```typescript
  // If not a product, try category
  console.log("[TRACE] ProductDetailPage - product is null, trying getCategoryBySlug with slug:", JSON.stringify({ slug }));
  const category = await getCategoryBySlug(slug);
  console.log("[TRACE] ProductDetailPage - getCategoryBySlug result:", JSON.stringify({ category: category ? { id: category.id, name: category.name, slug: category.slug } : null }));

  if (category) {
    const products = await getProductsByCategory(slug);
```

Replace with:

```typescript
  // If not a product, try category
  console.log("[TRACE] ProductDetailPage - product is null, trying getCategoryBySlug with slug:", JSON.stringify({ slug }));
  const category = await getCategoryBySlug(normalizedSlug);
  console.log("[TRACE] ProductDetailPage - getCategoryBySlug result:", JSON.stringify({ category: category ? { id: category.id, name: category.name, slug: category.slug } : null }));

  if (category) {
    const products = await getProductsByCategory(normalizedSlug);
```

(Only `slug` → `normalizedSlug` at the two call sites. Nothing else changes.)

- [ ] **Step 4: Run the existing test suite to confirm no regressions**

```powershell
npm test 2>&1 | Select-String -Pattern "PASS|FAIL|Tests|Error" | Select-Object -Last 20
```

Expected output ends with something like:

```
 Tests  X passed (X)
```

Zero failures. If any test fails, stop and investigate before continuing.

- [ ] **Step 5: Run the build to confirm no TypeScript errors**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|Error|warning|✓|✗" | Select-Object -Last 30
```

Expected: exits with code 0. `normalizedSlug` is `string` (return type of `decodeURIComponent`) so no type errors are expected. If the build fails, fix the TypeScript error before continuing.

- [ ] **Step 6: Commit**

```powershell
git add src/app/shop/`[slug`]/page.tsx
git commit -m "fix(shop): decode URL-encoded slug before Supabase lookup to fix 404 on spaced slugs"
```

---

### Task 2: Remove Temporary Trace Logs

**Files:**
- Modify: `src/app/shop/[slug]/page.tsx`
- Modify: `src/lib/services/products.ts`

The `[TRACE]` logs were added for debugging and must be removed before this work is considered done.

- [ ] **Step 1: Remove TRACE logs from `page.tsx`**

Open `src/app/shop/[slug]/page.tsx` and delete these lines (they will be at/near lines 24, 26, 125, 127, 166 after the Task 1 edit):

```typescript
  console.log("[TRACE] ProductDetailPage - params.slug:", JSON.stringify({ slug }));
```

```typescript
  console.log("[TRACE] ProductDetailPage - getProductBySlug result:", JSON.stringify({ product: product ? { id: product.id, name: product.name, slug: product.slug } : null }));
```

```typescript
  console.log("[TRACE] ProductDetailPage - product is null, trying getCategoryBySlug with slug:", JSON.stringify({ slug }));
```

```typescript
  console.log("[TRACE] ProductDetailPage - getCategoryBySlug result:", JSON.stringify({ category: category ? { id: category.id, name: category.name, slug: category.slug } : null }));
```

```typescript
  console.log("[TRACE] ProductDetailPage - CALLING notFound() for slug:", JSON.stringify({ slug }));
```

- [ ] **Step 2: Remove TRACE logs from `products.ts`**

Open `src/lib/services/products.ts` and delete these lines:

Inside `_cachedGetProductBySlug` (around lines 141–154):

```typescript
    console.log("[TRACE] _cachedGetProductBySlug - input slug:", JSON.stringify({ slug }));
```

```typescript
    console.log("[TRACE] _cachedGetProductBySlug - Supabase response:", JSON.stringify({
      data: data ? { id: data.id, name: data.name, slug: data.slug, status: data.status } : null,
      error: error ? { message: error.message, code: error.code } : null
    }));
```

Inside the public `getProductBySlug` function (around line 217):

```typescript
  console.log("[TRACE] getProductBySlug - received slug:", JSON.stringify({ slug, slugLength: slug.length, slugChars: slug.split('').map(c => `${c}(${c.charCodeAt(0)})`) }));
```

- [ ] **Step 3: Run the test suite again to confirm nothing broke during cleanup**

```powershell
npm test 2>&1 | Select-String -Pattern "PASS|FAIL|Tests|Error" | Select-Object -Last 10
```

Expected: same pass count as after Task 1. Zero failures.

- [ ] **Step 4: Commit the cleanup**

```powershell
git add src/app/shop/`[slug`]/page.tsx src/lib/services/products.ts
git commit -m "chore: remove TRACE debug logs from shop slug page and products service"
```

---

### Task 3: Post-Implementation Regression Matrix

**Files:** No code changes — evidence collection only.

- [ ] **Step 1: Start the dev server**

```powershell
npm run dev
```

Wait for `✓ Ready` before opening any URLs.

- [ ] **Step 2: Verify previously-failing products now load (Test Group A)**

Open each URL. Expected: HTTP 200, product page renders, product image renders, no console errors.

| URL | Expected |
|-----|----------|
| `http://localhost:3000/shop/Designer%20Sarees` | 200, product page, image |
| `http://localhost:3000/shop/Royal%20Weeding%20Lehenga` | 200, product page, image |
| `http://localhost:3000/shop/Royal%20Zari%20Bridal%20Premium%20Lehenga` | 200 or valid redirect — no route failure |

If `Designer%20Sarees` still returns 404 after the fix, stop. Do not check other routes. The fix did not work — re-examine whether the DB slug truly is `"Designer Sarees"` (Task 0 should have confirmed this).

- [ ] **Step 3: Verify existing working products are unaffected (Test Group B)**

| URL | Expected |
|-----|----------|
| `http://localhost:3000/shop/luxury-lehengas` | 200, unchanged |
| `http://localhost:3000/shop/mei-qa-draft-product` | 200, unchanged |
| `http://localhost:3000/shop/royal-bridal-lehenga-2` | 200, unchanged |

- [ ] **Step 4: Verify category pages are unaffected (Test Group C)**

| URL | Expected |
|-----|----------|
| `http://localhost:3000/shop/heritage-sarees` | 200, category banner + product grid |
| `http://localhost:3000/shop/bridal-anarkalis` | 200, category banner + product grid |

- [ ] **Step 5: Verify no-image product (Test Group D)**

Open: `http://localhost:3000/shop/qa-no-image-product`

Expected: 200, placeholder div visible, layout preserved, no broken-image icon.

- [ ] **Step 6: Verify storefront images (Test Group E)**

Open each page and filter DevTools Network tab by **Img**:

| URL | Check |
|-----|-------|
| `http://localhost:3000/` | Category images render, CSS gradient fallback renders for categories without `image_url` |
| `http://localhost:3000/shop` | Product card images render, no broken images |
| `http://localhost:3000/shop/luxury-lehengas` | Supabase image returns 200 in Network, no timeout |

- [ ] **Step 7: Console and network validation (all pages above)**

**Allowed (pre-existing):**
- LCP candidate warning

**Not allowed:**

```
Invalid src prop
hostname is not configured
Failed to load image
upstream image response timed out
```

Any of the above indicates a regression introduced by this change. Stop and investigate.

Verify all image requests to `https://hjhqemsyufsifmgespur.supabase.co/storage/v1/object/public/` return **200** — not 404, 500, or 504.

---

## Done Criteria Checklist

Mark complete only when ALL are checked with evidence:

**Root-cause gate (Task 0)**
- [ ] Terminal confirmed `params.slug = "Designer%20Sarees"` (percent-encoded) before fix
- [ ] `luxury-lehengas` confirmed working baseline before fix

**Implementation (Task 1)**
- [ ] `normalizedSlug` variable added after `await params`
- [ ] `getProductBySlug(normalizedSlug)` in place of `getProductBySlug(slug)`
- [ ] `getCategoryBySlug(normalizedSlug)` in place of `getCategoryBySlug(slug)`
- [ ] `getProductsByCategory(normalizedSlug)` in place of `getProductsByCategory(slug)`
- [ ] `npm test` passes with zero failures
- [ ] `npm run build` exits 0

**Cleanup (Task 2)**
- [ ] All `[TRACE]` logs removed from `page.tsx`
- [ ] All `[TRACE]` logs removed from `products.ts`
- [ ] `npm test` still passes after cleanup

**Regression matrix (Task 3)**
- [ ] `Designer%20Sarees` returns 200 after fix
- [ ] All three existing hyphenated product slugs still return 200
- [ ] Both category pages still render
- [ ] No-image placeholder still renders
- [ ] No new console errors on any page
- [ ] All Supabase image requests return 200 in DevTools Network
