# Search Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-accessible, production-grade search modal to the storefront header that filters products by name in real time, supports arrow-key navigation, restores focus on close, and links to the product detail page — with body scroll lock, ARIA dialog semantics, smooth CSS transitions, and state architecture ready for async Supabase search.

**Architecture:** `SearchModal` receives `Product[]` and owns `{ query, results, loading }` state plus arrow-key `highlightedIndex`. Header manages `isOpen` + a `ref` to the search button for focus restoration after close. Filter utility is multi-field-capable (tested independently). An analytics stub (`trackSearch`) provides a callsite without implementation. Animation uses CSS transitions gated by a two-stage `mounted`/`animateIn` flag pattern — no additional runtime dependencies.

**Tech Stack:** React 19 + Next.js 16, Tailwind CSS v4, vitest (node env), TypeScript strict

---

## Route Verification (completed pre-plan)

`src/app/shop/[slug]/page.tsx` confirmed. Product links use `/shop/${product.slug}`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/analytics/trackSearch.ts` | No-op analytics extension point |
| Create | `src/lib/utils/filterProducts.ts` | Multi-field extensible filter, returns `Product[]` |
| Create | `src/lib/utils/__tests__/filterProducts.test.ts` | Unit tests (node env, no DOM) |
| Create | `src/components/search/SearchModal.tsx` | Full modal: state, animation, keyboard nav, a11y |
| Modify | `src/components/layout/Header.tsx` | Wire open/close, ref for focus restoration, mount modal |

---

### Task 1: Analytics extension point

**Files:**
- Create: `src/lib/analytics/trackSearch.ts`

- [ ] **Step 1: Create the no-op stub**

Create `src/lib/analytics/trackSearch.ts`:

```typescript
// Extension point — replace body with real implementation when analytics lands
export function trackSearch(_query: string): void {
  // no-op
}
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics/trackSearch.ts
git commit -m "feat: add trackSearch analytics extension point (no-op)"
```

---

### Task 2: filterProducts utility + unit tests

**Files:**
- Create: `src/lib/utils/filterProducts.ts`
- Create: `src/lib/utils/__tests__/filterProducts.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/utils/__tests__/filterProducts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filterProducts } from "../filterProducts";
import type { Product } from "@/types";

function p(id: string, name: string, short_description: string | null = null): Product {
  return {
    id,
    name,
    slug: id,
    price: 100000,
    short_description,
    description: null,
    work_types: [],
    status: "PUBLISHED",
    category_id: "cat1",
    category: { id: "cat1", name: "Lehengas", slug: "lehengas" },
    image_url: "/img/test.png",
    images: ["/img/test.png"],
  };
}

const catalogue: Product[] = [
  p("p1", "The Rose Lehenga",         "A masterpiece in rose-red silk."),
  p("p2", "The Royal Velvet Lehenga", "Deep maroon velvet."),
  p("p3", "Ivory Blush Anarkali",     null),
];

describe("filterProducts — default field (name)", () => {
  it("returns empty array for empty query", () => {
    expect(filterProducts(catalogue, "")).toHaveLength(0);
  });

  it("returns empty array for whitespace-only query", () => {
    expect(filterProducts(catalogue, "   ")).toHaveLength(0);
  });

  it("trims leading/trailing whitespace before matching", () => {
    const result = filterProducts(catalogue, "  rose  ");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("matches by case-insensitive substring", () => {
    const result = filterProducts(catalogue, "rose");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("matches multiple products when query appears in several names", () => {
    const result = filterProducts(catalogue, "lehenga");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["p1", "p2"]);
  });

  it("is case-insensitive (UPPERCASE query)", () => {
    expect(filterProducts(catalogue, "IVORY")).toHaveLength(1);
  });

  it("is case-insensitive (MiXeD case query)", () => {
    expect(filterProducts(catalogue, "VeLvEt")).toHaveLength(1);
  });

  it("returns empty array when nothing matches", () => {
    expect(filterProducts(catalogue, "zzz-no-match")).toHaveLength(0);
  });

  it("handles empty products array", () => {
    expect(filterProducts([], "rose")).toHaveLength(0);
  });

  it("handles a very long query string without crashing", () => {
    const longQuery = "a".repeat(500);
    expect(filterProducts(catalogue, longQuery)).toHaveLength(0);
  });

  it("handles query with special characters without crashing", () => {
    expect(() => filterProducts(catalogue, "!@#$%^&*()")).not.toThrow();
    expect(filterProducts(catalogue, "!@#$%^&*()")).toHaveLength(0);
  });
});

describe("filterProducts — explicit fields", () => {
  it("searches short_description when specified", () => {
    const result = filterProducts(catalogue, "maroon", ["short_description"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  it("does not find a result in description when only name field is specified", () => {
    expect(filterProducts(catalogue, "maroon", ["name"])).toHaveLength(0);
  });

  it("searches across multiple fields simultaneously", () => {
    // 'rose' in name (p1); 'maroon' in short_description (p2)
    const byName = filterProducts(catalogue, "rose", ["name", "short_description"]);
    expect(byName).toHaveLength(1);
    expect(byName[0].id).toBe("p1");

    const byDesc = filterProducts(catalogue, "maroon", ["name", "short_description"]);
    expect(byDesc).toHaveLength(1);
    expect(byDesc[0].id).toBe("p2");
  });

  it("skips null field values without crashing", () => {
    // p3 has null short_description
    expect(() =>
      filterProducts(catalogue, "anything", ["short_description"])
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (module not found)**

```
npx vitest run src/lib/utils/__tests__/filterProducts.test.ts
```

Expected: FAIL — `Cannot find module '../filterProducts'`

- [ ] **Step 3: Implement filterProducts**

Create `src/lib/utils/filterProducts.ts`:

```typescript
import type { Product } from "@/types";

export type SearchableField = "name" | "short_description" | "description";

export function filterProducts(
  products: Product[],
  query: string,
  fields: ReadonlyArray<SearchableField> = ["name"]
): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter((product) =>
    fields.some((field) => {
      const value = product[field];
      return value != null && value.toLowerCase().includes(q);
    })
  );
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```
npx vitest run src/lib/utils/__tests__/filterProducts.test.ts
```

Expected: all tests pass, 0 failures.

- [ ] **Step 5: Run full suite to confirm no regressions**

```
npm test
```

Expected: all existing tests continue to pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/filterProducts.ts src/lib/utils/__tests__/filterProducts.test.ts
git commit -m "feat: add extensible filterProducts utility with unit tests"
```

---

### Task 3: SearchModal component

**Files:**
- Create: `src/components/search/SearchModal.tsx`

Component-level DOM testing requires jsdom which is not configured in this project (vitest uses `environment: "node"`). Correctness is verified via TypeScript and manual smoke-testing in Task 5.

- [ ] **Step 1: Create the component**

Create `src/components/search/SearchModal.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { filterProducts } from "@/lib/utils/filterProducts";
import { trackSearch } from "@/lib/analytics/trackSearch";
import type { Product } from "@/types";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export default function SearchModal({ isOpen, onClose, products }: SearchModalProps) {
  // Future-proof state: loading enables async Supabase swap without UI refactor
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Two-stage animation: mounted gates DOM presence; animateIn drives CSS transitions
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Mount/unmount with enter/exit animation + state reset on open
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setQuery("");
      setResults([]);
      setHighlightedIndex(-1);
      const id = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(id);
    } else {
      setAnimateIn(false);
      const id = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Focus input after mount animation frame
  useEffect(() => {
    if (isOpen && mounted) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, mounted]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Sync results from query (client-side for now; swap to async fetch for Supabase)
  useEffect(() => {
    const filtered = filterProducts(products, query, ["name"]);
    setResults(filtered.slice(0, 10));
    setHighlightedIndex(-1);
    if (query.trim()) {
      trackSearch(query.trim());
    }
  }, [query, products]);

  // Keyboard: Esc / Arrow keys / Enter + Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;

        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, -1));
          break;

        case "Enter":
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            router.push(`/shop/${results[highlightedIndex].slug}`);
            onClose();
          }
          break;

        case "Tab": {
          const modal = modalRef.current;
          if (!modal) return;
          const focusable = Array.from(
            modal.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, highlightedIndex, results, router]);

  if (!mounted) return null;

  return (
    // Outer wrapper — fades backdrop on enter/exit; click backdrop to close
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 transition-opacity duration-200 ease-in-out ${
        animateIn ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
      role="presentation"
    >
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal panel — scales + fades on enter/exit */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        className={`relative w-full max-w-xl bg-[#faf8f5] rounded-lg shadow-2xl overflow-hidden transition-all duration-200 ease-in-out ${
          animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="search-modal-title" className="sr-only">Search products</h2>

        {/* Input row */}
        <div className="flex items-center px-4 py-3 border-b border-[#e8e0d5]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-[#c9a465] flex-shrink-0 mr-3"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pieces…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#1a1a1a] placeholder-[#9a9a9a] text-sm font-inter outline-none"
            aria-label="Search query"
          />
          <button
            onClick={onClose}
            className="ml-3 text-[#4a4a4a] hover:text-[#1a1a1a] transition-colors cursor-pointer"
            aria-label="Close search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() === "" ? (
            <p className="px-4 py-6 text-center text-xs text-[#9a9a9a] font-inter uppercase tracking-widest">
              Start typing to search
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-xs text-[#9a9a9a] font-inter">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#9a9a9a] font-inter">
              No pieces found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul>
              {results.map((product, index) => {
                const imageSrc =
                  product.image_url ||
                  product.images?.[0] ||
                  "/images/placeholder.jpg";
                return (
                  <li key={product.id}>
                    <Link
                      href={`/shop/${product.slug}`}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        index === highlightedIndex
                          ? "bg-[#f5f0ea]"
                          : "hover:bg-[#f5f0ea]"
                      }`}
                    >
                      <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-[#e8e0d5]">
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] font-inter truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-[#4a4a4a] font-inter">
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(product.price)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

Expected: zero errors. Fix any before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/components/search/SearchModal.tsx
git commit -m "feat: add production-grade SearchModal (animation, keyboard nav, a11y, scroll lock)"
```

---

### Task 4: Wire Header.tsx

**Files:**
- Modify: `src/components/layout/Header.tsx`

The complete updated file (only isolated additions: two imports, `searchOpen` state, `searchButtonRef`, `handleSearchClose`, updated search button, fragment wrapper, `<SearchModal>` mount):

- [ ] **Step 1: Replace the full file contents**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/cart";
import { useEffect, useRef, useState } from "react";
import { MOCK_PRODUCTS } from "@/lib/data/mockProducts";
import SearchModal from "@/components/search/SearchModal";

export default function Header() {
  const pathname = usePathname();
  const itemCount = useCartStore((state) => state.itemCount);
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearchClose = () => {
    setSearchOpen(false);
    // Restore focus to the trigger so keyboard users don't lose their place
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };

  const navLinks = [
    { href: "/", label: "Collections" },
    { href: "/new-arrivals", label: "New Arrivals" },
    { href: "/shop", label: "Lehengas" },
    { href: "/atelier", label: "The Atelier" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <>
      <header className="top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e8e0d5]/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 mt-7 mb-0">
          {/* Row 1: Logo & Icons */}
          <div className="relative flex justify-between items-center h-12">
            {/* Invisible Spacer to center logo */}
            <div className="flex-1 md:block hidden" />

            {/* Logo (Centered) */}
            <div className="flex-1 text-center md:absolute md:left-1/2 md:-translate-x-1/2 flex flex-col items-center">
              <Link href="/" className="inline-block group">
                <h1 className="text-3xl font-bold tracking-[0.25em] uppercase text-[#c9a465] group-hover:text-[#d4b87a] transition-colors duration-300 font-inter select-none leading-none text-center">
                  MEI
                </h1>
                <span className="block text-[10px] font-bold uppercase tracking-[0.35em] text-[#c9a465] group-hover:text-[#d4b87a] transition-colors duration-300 mt-1 font-inter text-center">
                  BRIDAL COUTURE
                </span>
              </Link>
            </div>

            {/* Right Action Icons */}
            <div className="flex-1 flex justify-end items-center space-x-6">
              {/* Search Button */}
              <button
                ref={searchButtonRef}
                onClick={() => setSearchOpen(true)}
                className="text-[#1a1a1a] hover:text-[#c9a465] transition-colors duration-300 cursor-pointer"
                aria-label="Open search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
                  />
                </svg>
              </button>

              {/* Wishlist Button */}
              <button className="text-[#1a1a1a] hover:text-[#c9a465] transition-colors duration-300 cursor-pointer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                  />
                </svg>
              </button>

              {/* Cart Button */}
              <Link
                href="/cart"
                className="relative text-[#1a1a1a] hover:text-[#c9a465] transition-colors duration-300 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                {mounted && itemCount() > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#c9a465] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center font-inter">
                    {itemCount()}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Row 2: Centered Navigation links */}
          <div className="mt-4 flex justify-start md:justify-center pt-4 overflow-x-auto scrollbar-none w-full">
            <nav className="flex space-x-8 sm:space-x-12 px-6 md:px-0 whitespace-nowrap">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`text-xs sm:text-[13px] font-inter font-medium uppercase tracking-[0.18em] transition-all pb-1.5 relative group hover:text-[#c9a465] ${
                      isActive ? "text-[#c9a465]" : "text-[#4a4a4a]"
                    }`}
                  >
                    {link.label}
                    <span
                      className={`absolute bottom-0 left-0 w-full h-[1.5px] bg-[#c9a465] transform transition-transform duration-300 origin-left ${
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <SearchModal
        isOpen={searchOpen}
        onClose={handleSearchClose}
        products={MOCK_PRODUCTS}
      />
    </>
  );
}
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Full test suite**

```
npm test
```

Expected: all tests pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: wire Header search button to SearchModal with focus restoration"
```

---

### Task 5: Manual smoke-test — golden path, keyboard, a11y, mobile

Start the dev server:

```
npm run dev
```

Open `http://localhost:3000`.

**Functional acceptance criteria:**

- [ ] Click search icon → modal opens with input auto-focused.
- [ ] Type `rose` → "The Rose Lehenga" appears with thumbnail, name, INR price.
- [ ] Type `lehenga` → two result rows appear (capped at 10 max).
- [ ] Type `zzz` → "No pieces found for 'zzz'" empty state.
- [ ] Clear input → "Start typing to search" placeholder state.
- [ ] Click a result → modal closes, browser navigates to `/shop/<slug>`.
- [ ] Press `Esc` → modal closes.
- [ ] Click dark backdrop → modal closes.
- [ ] Reopen modal → input is blank, no stale state from previous session.

**Keyboard navigation:**

- [ ] Type `lehenga` → two results visible.
- [ ] Press `ArrowDown` → first result highlighted with `bg-[#f5f0ea]` background.
- [ ] Press `ArrowDown` again → second result highlighted; first loses highlight.
- [ ] Press `ArrowUp` → first result highlighted again.
- [ ] Press `Enter` → navigates to that product's page, modal closes.
- [ ] ArrowUp from index 0 → highlighted index returns to -1 (no result highlighted).

**Focus and accessibility:**

- [ ] Close modal (any method) → focus returns to the search icon button in the header.
- [ ] Open DevTools Accessibility panel → `role="dialog"`, accessible name "Search products" visible.
- [ ] Tab through open modal → focus cycles: input → close button → result links → back to input. Never escapes to page behind modal.
- [ ] Shift+Tab cycles in reverse within modal.

**Body scroll lock:**

- [ ] Open modal → attempt to scroll the page behind. Page must not scroll.
- [ ] Open DevTools console → run `document.body.style.overflow`. Expected: `"hidden"`.
- [ ] Close modal → page scroll restored. Run `document.body.style.overflow`. Expected: `""`.

**Animation:**

- [ ] Open modal → backdrop fades in and panel scales up from 95% over 200ms. No pop.
- [ ] Close modal → backdrop/panel fade out before DOM is removed.

**Mobile responsiveness** — use DevTools device emulator at each width:

| Width | No horizontal scroll | Modal fully visible | Close button reachable |
|-------|---------------------|--------------------|-----------------------|
| 320px | [ ] | [ ] | [ ] |
| 360px | [ ] | [ ] | [ ] |
| 375px | [ ] | [ ] | [ ] |
| 390px | [ ] | [ ] | [ ] |
| 412px | [ ] | [ ] | [ ] |

---

### Task 6: Mandatory validation gate

Do not mark the feature complete until all four commands pass with zero errors or warnings.

- [ ] **Lint**

```
npm run lint
```

Expected: clean. Fix any errors before continuing.

- [ ] **TypeScript**

```
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Tests**

```
npm test
```

Expected: all tests pass.

- [ ] **Production build**

```
npm run build
```

Expected: build completes successfully. Fix any errors (missing imports, invalid JSX, unused variables caught by strict mode) before marking done.

Only after all four pass is the ticket complete.

---

## Regression Scope

Changes are isolated to:
- `src/lib/analytics/trackSearch.ts` (new)
- `src/lib/utils/filterProducts.ts` (new)
- `src/lib/utils/__tests__/filterProducts.test.ts` (new)
- `src/components/search/SearchModal.tsx` (new)
- `src/components/layout/Header.tsx` (search-related additions only)

Do not modify any other file. No opportunistic cleanup, no unrelated refactors.

---

## Supabase Swap Guide (future reference)

When Supabase full-text search lands:

1. In `SearchModal`'s query `useEffect`: replace synchronous `filterProducts(...)` with `await supabase.rpc("search_products", { query })`, set `loading` to `true` before and `false` after.
2. The `loading` state already renders a "Searching…" placeholder — no UI changes needed.
3. Replace `trackSearch` body with the real analytics call.
4. `filterProducts`, `SearchableField`, Header wiring, and all tests remain unchanged.
