# Shipping Threshold Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ₹150 flat shipping for orders under ₹5,000 and free shipping at or above ₹5,000, surfaced consistently in cart, checkout, and the announcement bar, with all values sourced from a single config file.

**Architecture:** A pure config module (`src/lib/config/shipping.ts`) is the single source of truth for rates and calculation helpers. A shared formatting utility (`src/lib/utils/format.ts`) replaces the duplicated `formatPrice` inline functions in the in-scope files. Cart and checkout pages derive shipping and grand total from the helpers. `PromoStrip` becomes a client component that reads live cart state to show a contextual message. `OrderSummary.tsx` (currently unused component) is patched for consistency.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand (cart store), Vitest (unit tests — not yet installed)

---

## Codebase Audit Results

**Test infrastructure:** No test framework present in `package.json`. Vitest must be installed.

**Currency formatting:** `formatPrice` (identical `Intl.NumberFormat` implementation) is duplicated across `cart/page.tsx`, `checkout/page.tsx`, `components/checkout/OrderSummary.tsx`, `components/shop/ProductCard.tsx`, `app/shop/[slug]/page.tsx`. A shared utility does not exist. This plan extracts it for the in-scope files only; `ProductCard.tsx` and `shop/[slug]/page.tsx` are out of scope.

**Order payload:** `src/app/checkout/page.tsx:handleSubmit` is a mock (sets a `setTimeout`, calls `clearCart()`, generates a fake `MEI-XXXXXX` order ID). There is no real payment API, Razorpay SDK import, or backend call. The Pay Now button label must display `grandTotal` (including shipping). No external payload is submitted so there is no mismatch risk at the API layer — the displayed amounts are the only surface to fix.

**Unused components:** `src/components/checkout/CheckoutForm.tsx` and `src/components/checkout/OrderSummary.tsx` are defined but never imported anywhere in the app. They are updated in this plan for consistency, not for live behaviour.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/config/shipping.ts` | `FREE_SHIPPING_THRESHOLD`, `SHIPPING_FLAT_RATE`, `calculateShipping`, `getRemainingForFreeShipping` |
| Create | `src/lib/config/shipping.test.ts` | Unit tests for both helpers, including boundary/decimal cases |
| Create | `src/lib/utils/format.ts` | Shared `formatCurrency` — replaces duplicated `formatPrice` in in-scope files |
| Create | `vitest.config.ts` | Vitest config with `@` path alias |
| Modify | `package.json` | Add `vitest` devDep and `"test"` script |
| Modify | `src/components/layout/PromoStrip.tsx` | Client component — reads cart total, shows dynamic threshold message |
| Modify | `src/app/cart/page.tsx` | `calculateShipping` + `formatCurrency`, correct shipping row + grand total |
| Modify | `src/app/checkout/page.tsx` | Same as cart; Pay Now button label uses grand total |
| Modify | `src/components/checkout/OrderSummary.tsx` | Fix shipping row; grand total includes shipping (unused component, patched for consistency) |

---

## Task 1: Install Vitest and write shipping config with tests

**Files:**
- Create: `src/lib/config/shipping.ts`
- Create: `src/lib/config/shipping.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest
```

Expected: `package.json` gains `"vitest"` in `devDependencies`. No other test packages are added — the project has no existing test framework.

- [ ] **Step 2: Create vitest.config.ts**

Create `vitest.config.ts` at the project root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add `"test": "vitest run"` to the `scripts` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
}
```

- [ ] **Step 4: Write the failing tests first**

Create `src/lib/config/shipping.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT_RATE,
  calculateShipping,
  getRemainingForFreeShipping,
} from "./shipping";

describe("shipping constants", () => {
  it("exports the correct threshold", () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(5000);
  });

  it("exports the correct flat rate", () => {
    expect(SHIPPING_FLAT_RATE).toBe(150);
  });
});

describe("calculateShipping", () => {
  it("returns flat rate when subtotal is zero", () => {
    expect(calculateShipping(0)).toBe(150);
  });

  it("returns flat rate when subtotal is below threshold", () => {
    expect(calculateShipping(1000)).toBe(150);
    expect(calculateShipping(4999)).toBe(150);
  });

  it("returns flat rate just below threshold (decimal boundary)", () => {
    expect(calculateShipping(4999.99)).toBe(150);
  });

  it("returns 0 when subtotal equals the threshold exactly", () => {
    expect(calculateShipping(5000)).toBe(0);
  });

  it("returns 0 just above threshold (decimal boundary)", () => {
    expect(calculateShipping(5000.01)).toBe(0);
  });

  it("returns 0 when subtotal is well above threshold", () => {
    expect(calculateShipping(100000)).toBe(0);
  });
});

describe("getRemainingForFreeShipping", () => {
  it("returns the full threshold when cart is empty", () => {
    expect(getRemainingForFreeShipping(0)).toBe(5000);
  });

  it("returns the correct remaining amount when below threshold", () => {
    expect(getRemainingForFreeShipping(3000)).toBe(2000);
    expect(getRemainingForFreeShipping(4999)).toBe(1);
  });

  it("returns 0 when subtotal equals threshold", () => {
    expect(getRemainingForFreeShipping(5000)).toBe(0);
  });

  it("returns 0 when subtotal exceeds threshold", () => {
    expect(getRemainingForFreeShipping(6000)).toBe(0);
    expect(getRemainingForFreeShipping(100000)).toBe(0);
  });
});
```

- [ ] **Step 5: Run tests — confirm they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './shipping'`

- [ ] **Step 6: Write the shipping config**

Create `src/lib/config/shipping.ts`:

```ts
export const FREE_SHIPPING_THRESHOLD = 5000;
export const SHIPPING_FLAT_RATE = 150;

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
}

export function getRemainingForFreeShipping(subtotal: number): number {
  return Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
}
```

- [ ] **Step 7: Run tests — confirm they pass**

```bash
npm test
```

Expected: all assertions PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/config/shipping.ts src/lib/config/shipping.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add shipping config with calculateShipping/getRemainingForFreeShipping and Vitest"
```

---

## Task 2: Extract shared currency formatter

**Files:**
- Create: `src/lib/utils/format.ts`

`formatPrice` is duplicated verbatim in five files. This task extracts it for the files touched in this plan. Creating the utility now keeps later tasks DRY.

- [ ] **Step 1: Create the utility**

Create `src/lib/utils/format.ts`:

```ts
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/format.ts
git commit -m "feat: add shared formatCurrency utility"
```

---

## Task 3: Update PromoStrip — dynamic cart-aware message

**Files:**
- Modify: `src/components/layout/PromoStrip.tsx`

The component currently always shows "Free Shipping on orders above ₹5,000" (static string, threshold hardcoded). It should become a client component that reads the live cart subtotal and shows a contextual message. The threshold value must come from config.

Behaviour:
- Cart empty (`subtotal === 0`): "Free Shipping on orders above ₹5,000" (standard awareness message)
- Cart has items, below threshold: "Add ₹X more to your order for free shipping"
- Cart at or above threshold: "You've unlocked free shipping on your order!"

- [ ] **Step 1: Replace PromoStrip.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
import {
  FREE_SHIPPING_THRESHOLD,
  getRemainingForFreeShipping,
} from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";

export default function PromoStrip() {
  const total = useCartStore((state) => state.total);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultMessage = `Free Shipping on orders above ${formatCurrency(FREE_SHIPPING_THRESHOLD)}`;

  if (!mounted) {
    return (
      <div className="bg-[#c9a465] text-white text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center font-inter select-none">
        {defaultMessage}
      </div>
    );
  }

  const subtotal = total();
  const remaining = getRemainingForFreeShipping(subtotal);

  let message: string;
  if (subtotal === 0) {
    message = defaultMessage;
  } else if (remaining > 0) {
    message = `Add ${formatCurrency(remaining)} more to your order for free shipping`;
  } else {
    message = "You've unlocked free shipping on your order!";
  }

  return (
    <div className="bg-[#c9a465] text-white text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center font-inter select-none">
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/PromoStrip.tsx
git commit -m "feat: make PromoStrip cart-aware with dynamic free-shipping messaging"
```

---

## Task 4: Update cart page

**Files:**
- Modify: `src/app/cart/page.tsx`

Replace the inline `formatPrice` with `formatCurrency`. Add shipping derivation. Fix the shipping row and the grand total.

- [ ] **Step 1: Replace the import block at the top of cart/page.tsx**

Current imports:

```tsx
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
```

Replace with:

```tsx
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
import { calculateShipping } from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";
```

- [ ] **Step 2: Remove the inline formatPrice function**

Delete lines 19–25 (the entire `formatPrice` arrow function):

```tsx
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };
```

- [ ] **Step 3: Add shipping derivation before the !mounted guard**

After `const total = useCartStore(...)` and the `useState(false)` block, add:

```tsx
  const subtotal = total();
  const shipping = calculateShipping(subtotal);
  const grandTotal = subtotal + shipping;
```

Place this after `const [mounted, setMounted] = useState(false);` but before `useEffect`.

- [ ] **Step 4: Replace all formatPrice calls with formatCurrency**

The file currently calls `formatPrice(...)` in three places. Replace each one:

`formatPrice(item.price)` → `formatCurrency(item.price)`

`formatPrice(total())` (subtotal line in Order Summary) → `formatCurrency(subtotal)`

`formatPrice(total())` (Total line) → `formatCurrency(grandTotal)`

- [ ] **Step 5: Replace the Shipping row**

Find:

```tsx
                <div className="flex justify-between text-[#4a4a4a]">
                  <span>Shipping</span>
                  <span className="text-[#c9a465] font-semibold uppercase tracking-wider">
                    Complimentary
                  </span>
                </div>
```

Replace with:

```tsx
                <div className="flex justify-between text-[#4a4a4a]">
                  <span>Shipping</span>
                  {shipping === 0 ? (
                    <span className="text-[#c9a465] font-semibold uppercase tracking-wider">
                      Free
                    </span>
                  ) : (
                    <span className="font-semibold text-[#1a1a1a]">
                      {formatCurrency(shipping)}
                    </span>
                  )}
                </div>
```

- [ ] **Step 6: Verify TypeScript compiles and tests still pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors; all shipping tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/cart/page.tsx
git commit -m "feat: apply shipping threshold logic to cart order summary"
```

---

## Task 5: Update checkout page

**Files:**
- Modify: `src/app/checkout/page.tsx`

Same pattern as cart. The Pay Now button label must also use `grandTotal`.

**Order payload note:** `handleSubmit` is a mock (no real API call). The displayed amounts — shipping row, total row, and Pay Now button — are the only surfaces. All three must reflect `grandTotal`.

- [ ] **Step 1: Replace the import block at the top of checkout/page.tsx**

Current imports:

```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
```

Replace with:

```tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { calculateShipping } from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";
```

- [ ] **Step 2: Remove the inline formatPrice function**

Delete lines 114–120 (the entire `formatPrice` arrow function):

```tsx
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };
```

- [ ] **Step 3: Extend the subtotal derivation block**

The file already has `const subtotalVal = total();` near line 174. Extend it to:

```tsx
  const subtotalVal = total();
  const shipping = calculateShipping(subtotalVal);
  const grandTotal = subtotalVal + shipping;
```

- [ ] **Step 4: Replace all formatPrice calls with formatCurrency**

Replace every `formatPrice(...)` call in the file:

- `formatPrice(item.price)` → `formatCurrency(item.price)`
- `formatPrice(subtotalVal)` (subtotal line) → `formatCurrency(subtotalVal)`
- `formatPrice(subtotalVal)` (Total row) → `formatCurrency(grandTotal)`
- `` `Pay Now — ${formatPrice(subtotalVal)}` `` → `` `Pay Now — ${formatCurrency(grandTotal)}` ``

- [ ] **Step 5: Replace the Shipping row in the checkout order summary**

Find:

```tsx
              <div className="flex justify-between text-[#4a4a4a] font-medium">
                <span className="uppercase text-xs tracking-widest font-bold">Shipping</span>
                <span className="text-[#c9a465] uppercase font-bold text-xs tracking-widest">Free</span>
              </div>
```

Replace with:

```tsx
              <div className="flex justify-between text-[#4a4a4a] font-medium">
                <span className="uppercase text-xs tracking-widest font-bold">Shipping</span>
                {shipping === 0 ? (
                  <span className="text-[#c9a465] uppercase font-bold text-xs tracking-widest">Free</span>
                ) : (
                  <span className="font-bold text-xs text-[#1a1a1a]">{formatCurrency(shipping)}</span>
                )}
              </div>
```

- [ ] **Step 6: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat: apply shipping threshold logic to checkout — shipping row, total, and Pay Now button"
```

---

## Task 6: Patch OrderSummary component (unused — consistency fix)

**Files:**
- Modify: `src/components/checkout/OrderSummary.tsx`

This component is not imported anywhere in the app (confirmed by grep). It is patched so that if it is ever wired up, it will show correct shipping and grand total values. The existing `estimatedTax` calculation (12% GST) is preserved.

- [ ] **Step 1: Replace the import block**

Current imports:

```tsx
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
```

Replace with:

```tsx
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
import { calculateShipping } from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";
```

- [ ] **Step 2: Remove the inline formatPrice function**

Delete lines 16–22:

```tsx
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };
```

- [ ] **Step 3: Fix the grandTotal derivation**

Find:

```tsx
  const estimatedTax = total() * 0.12; // 12% GST standard for luxury apparel in India
  const grandTotal = total() + estimatedTax;
```

Replace with:

```tsx
  const subtotalVal = total();
  const shipping = calculateShipping(subtotalVal);
  const estimatedTax = subtotalVal * 0.12;
  const grandTotal = subtotalVal + shipping + estimatedTax;
```

- [ ] **Step 4: Replace the Shipping row**

Find:

```tsx
        <div className="flex justify-between text-[#4a4a4a]">
          <span>Shipping</span>
          <span className="text-[#c9a465] font-medium uppercase tracking-wider">
            Complimentary
          </span>
        </div>
```

Replace with:

```tsx
        <div className="flex justify-between text-[#4a4a4a]">
          <span>Shipping</span>
          {shipping === 0 ? (
            <span className="text-[#c9a465] font-medium uppercase tracking-wider">Free</span>
          ) : (
            <span className="font-medium text-[#1a1a1a]">{formatCurrency(shipping)}</span>
          )}
        </div>
```

- [ ] **Step 5: Replace all formatPrice calls with formatCurrency**

- `formatPrice(item.price * item.quantity)` → `formatCurrency(item.price * item.quantity)`
- `formatPrice(total())` (subtotal) → `formatCurrency(subtotalVal)`
- `formatPrice(estimatedTax)` → `formatCurrency(estimatedTax)`
- `formatPrice(grandTotal)` → `formatCurrency(grandTotal)`

- [ ] **Step 6: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/checkout/OrderSummary.tsx
git commit -m "fix: shipping threshold logic in OrderSummary component"
```

---

## Regression Validation Checklist

Run these checks manually before marking the ticket complete.

- [ ] Cart subtotal below ₹5,000 shows ₹150 shipping line and adds it to the grand total
- [ ] Cart subtotal equal to ₹5,000 shows "Free" shipping line; grand total equals subtotal
- [ ] Cart subtotal above ₹5,000 shows "Free" shipping line; grand total equals subtotal
- [ ] Checkout shipping row updates correctly for both threshold states
- [ ] Checkout grand total (Total row) includes shipping in both states
- [ ] Checkout Pay Now button amount matches the checkout Total row amount
- [ ] PromoStrip shows default message when cart is empty
- [ ] PromoStrip shows "Add ₹X more…" when cart has items below ₹5,000
- [ ] PromoStrip shows "You've unlocked free shipping…" when cart is at or above ₹5,000
- [ ] Existing cart quantity controls and remove buttons remain unaffected
- [ ] Existing checkout form validation remains unaffected
- [ ] `npm test` passes

---

## Self-Review

**Spec coverage:**

| Acceptance Criterion | Covered by |
|---|---|
| Subtotal < ₹5,000 → ₹150 flat shipping | Task 1 (`calculateShipping`), Task 4 (cart), Task 5 (checkout) |
| Subtotal ≥ ₹5,000 → free | Task 1, Task 4, Task 5 |
| Cart order summary reflects this in the total | Task 4 |
| Checkout order summary reflects this in the total | Task 5 |
| Announcement bar messaging reflects the threshold | Task 3 |
| Threshold + flat rate read from config, not hardcoded inline | Task 1 is the single source; Tasks 3–6 all import from it |

**Enhancement coverage:**

| Enhancement | Covered by |
|---|---|
| Verify existing test infrastructure | Audited — none found; Vitest installed in Task 1 |
| `getRemainingForFreeShipping` exported from shipping.ts | Task 1 |
| Reuse existing currency formatter | No utility existed; Task 2 creates it; Tasks 3–6 consume it |
| Audit checkout order payload | Audited — mock only, no API; Pay Now label fixed in Task 5 |
| Boundary/decimal test coverage | Task 1 (4999.99, 5000, 5000.01 cases) |
| Announcement bar reflects cart state (Option B preferred) | Task 3 — fully dynamic client component |

**Placeholder scan:** No TBDs, no "add appropriate" phrases, no missing code blocks.

**Type consistency:** `calculateShipping(subtotal: number): number`, `getRemainingForFreeShipping(subtotal: number): number`, `formatCurrency(amount: number): string` — all used with the same parameter types throughout Tasks 3–6.
