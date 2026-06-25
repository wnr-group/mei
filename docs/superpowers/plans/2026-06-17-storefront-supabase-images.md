# Storefront Supabase Storage Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the storefront render product and category images from Supabase Storage public URLs, with sensible fallbacks when images are absent.

**Architecture:** The data layer (`_mapDbRowToProduct`, `_mapDbRowToCategory`) already returns Supabase Storage URLs verbatim from the DB — no mapper changes are needed. The three gaps are: (1) `next.config.ts` hardcodes `https` protocol and no port, so `http://localhost:54321` (local Supabase) is blocked by `next/image`; (2) the category grid on the home page falls back to a local static file that won't exist in all environments; (3) `ImageGallery` returns `null` when there are no images, breaking the two-column product detail layout.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase JS v2, Vitest, Tailwind CSS v4

---

## File Map

| File | Change |
|---|---|
| `next.config.ts` | Extract protocol + port from Supabase URL; use them in remotePatterns |
| `src/lib/services/__tests__/products.test.ts` | Add regression test: `images = []` when product_media empty AND image_url null |
| `src/app/page.tsx` | Category grid: conditional `<Image>` vs. gradient placeholder div |
| `src/components/product/ImageGallery.tsx` | Return styled placeholder div instead of `null` when no valid images |

---

### Task 1: Add regression test for no-image mapper path

**Files:**
- Modify: `src/lib/services/__tests__/products.test.ts`

This test covers the code path where `product_media` is empty **and** `image_url` is null — the product has no image at all. The mapper already handles it (`images = []`), but there is no test guarding against regression.

- [ ] **Step 1: Add the test**

Open `src/lib/services/__tests__/products.test.ts`. Inside the existing `describe("_mapDbRowToProduct", ...)` block (after the last `it` at line 85), add:

```ts
  it("returns empty images array when product_media is empty and image_url is null", () => {
    const p = _mapDbRowToProduct(
      baseRow({ product_media: [], image_url: null })
    );
    expect(p.images).toEqual([]);
    expect(p.image_url).toBeNull();
  });
```

- [ ] **Step 2: Run the test suite to confirm the new test passes**

```
npm test
```

Expected: all tests pass (including the new one — the mapper already handles this path).

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/__tests__/products.test.ts
git commit -m "test: add regression guard for empty images when product has no media or image_url"
```

---

### Task 2: Fix next.config.ts to support local Supabase (http + port)

**Files:**
- Modify: `next.config.ts`

Local Supabase runs at `http://localhost:54321`. The current config always uses `protocol: "https"` and `port: ""`, so `next/image` refuses to serve images from that origin in dev.

The fix: extract `protocol` and `port` from the parsed `NEXT_PUBLIC_SUPABASE_URL` and pass them into the remotePattern. Production Supabase URLs are always `https` with no explicit port (443), so `port` stays `""` in prod.

- [ ] **Step 1: Replace the contents of `next.config.ts`**

```ts
import type { NextConfig } from "next";

let supabaseHostname = "hjhqemsyufsifmgespur.supabase.co";
let supabaseProtocol: "http" | "https" = "https";
let supabasePort = "";

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    supabaseHostname = parsed.hostname;
    supabaseProtocol = parsed.protocol === "http:" ? "http" : "https";
    supabasePort = parsed.port;
  } catch {
    // Ignore malformed URL
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: supabaseProtocol,
        hostname: supabaseHostname,
        port: supabasePort,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify the build succeeds**

```
npm run build
```

Expected: exits with code 0, no `next/image` configuration errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix(config): support http + port in next/image remotePatterns for local Supabase"
```

---

### Task 3: Fix category image fallback in home page

**Files:**
- Modify: `src/app/page.tsx`

The category grid currently renders `<Image src={cat.image_url ?? "/images/rose_lehenga.png"} ...>`. When `cat.image_url` is null, it falls back to a local static file that may not exist in all environments. Replace the fallback with a CSS gradient placeholder so the card still renders a full-height background.

- [ ] **Step 1: Update the category card in `src/app/page.tsx`**

Find this block (around line 62–68):

```tsx
                <Image
                  src={cat.image_url ?? "/images/rose_lehenga.png"}
                  alt={cat.name}
                  fill
                  sizes="(max-width: 1280px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
```

Replace it with:

```tsx
                {cat.image_url ? (
                  <Image
                    src={cat.image_url}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 1280px) 33vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#a69c90] to-[#6b6460]" />
                )}
```

- [ ] **Step 2: Run the dev server and verify**

```
npm run dev
```

Navigate to `http://localhost:3000`. Check the "Shop by Category" section:
- If a category has `image_url` set (Supabase Storage URL) → image renders normally
- If `image_url` is null → a warm grey/taupe gradient fills the card; all overlay text and hover effects still work

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(home): replace local image fallback with CSS gradient for categories without image_url"
```

---

### Task 4: Add no-image placeholder to ImageGallery

**Files:**
- Modify: `src/components/product/ImageGallery.tsx`

When a product has no images at all (`product.images = []`), `ImageGallery` currently returns `null`. On the product detail page (`src/app/shop/[slug]/page.tsx` line 61) this leaves the entire left column empty, breaking the two-column grid layout.

Replace the early return with a styled placeholder div that preserves the `aspect-[3/4]` space.

- [ ] **Step 1: Update `src/components/product/ImageGallery.tsx`**

Find this block (lines 13–14):

```tsx
  const validImages = (images || []).filter(Boolean);
  if (validImages.length === 0) return null;
```

Replace it with:

```tsx
  const validImages = (images || []).filter(Boolean);
  if (validImages.length === 0) {
    return (
      <div className="relative aspect-[3/4] w-full bg-[#faf8f5] border border-[#e8e0d5]/40 flex items-center justify-center">
        <span className="text-[#9a9a9a] text-xs uppercase tracking-wider font-semibold select-none font-inter">
          No Image Available
        </span>
      </div>
    );
  }
```

- [ ] **Step 2: Verify in dev**

```
npm run dev
```

Navigate to a product detail page (`/shop/<any-slug>`). If the product has no images in Supabase, the left column should now show a beige placeholder with "NO IMAGE AVAILABLE" instead of collapsing entirely. If the product has images, the gallery renders as before.

- [ ] **Step 3: Commit**

```bash
git add src/components/product/ImageGallery.tsx
git commit -m "fix(gallery): render placeholder div instead of null when product has no images"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Storefront renders images from Supabase Storage public URLs | Already handled by mapper (no code change needed). Confirmed by reading `_mapDbRowToProduct`. |
| `next.config.ts` allows Supabase host (localhost in dev) | Task 2 |
| Sensible fallback when product has no image | Task 3 (categories) + Task 4 (product gallery) + existing `ProductCard` "No Image" span |

**Placeholder scan:** No TBD/TODO/placeholder language in any step. All code blocks are complete.

**Type consistency:** `supabaseProtocol` typed as `"http" | "https"` which matches the `NextConfig` `remotePatterns[].protocol` type. No cross-task type mismatches.
