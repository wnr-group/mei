# WhatsApp Floating Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent floating WhatsApp button to every page and centralise the phone number in a single env-backed config constant so both the button and the product-page inquiry link share one source.

**Architecture:** A `src/lib/config/whatsapp.ts` module reads `NEXT_PUBLIC_WHATSAPP_NUMBER` from the environment and exports a `buildWhatsAppUrl(text)` helper. A `WhatsAppButton` client component uses that helper and mounts via the root Server Component layout. `ProductDetailClient` is updated to call `buildWhatsAppUrl` instead of embedding the number inline.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Tailwind CSS v4, Vitest

---

### Task 1: Add the env variable

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Append to `.env.example`**

Add these two lines at the end of `.env.example`:
```
# WhatsApp — international format without +, e.g. 919876543210
NEXT_PUBLIC_WHATSAPP_NUMBER=91XXXXXXXXXX
```

- [ ] **Step 2: Append to `.env.local`**

Add this line at the end of `.env.local`:
```
NEXT_PUBLIC_WHATSAPP_NUMBER=919876543210
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .env.local
git commit -m "chore: add NEXT_PUBLIC_WHATSAPP_NUMBER env variable"
```

---

### Task 2: Create the whatsapp config module (TDD)

**Files:**
- Create: `src/lib/config/__tests__/whatsapp.test.ts`
- Create: `src/lib/config/whatsapp.ts`

The vitest config (`vitest.config.ts`) uses `environment: "node"` and includes `src/**/__tests__/**/*.test.ts` — this path matches.

- [ ] **Step 1: Write the failing test**

Create `src/lib/config/__tests__/whatsapp.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl } from "../whatsapp";

describe("buildWhatsAppUrl", () => {
  it("returns a wa.me URL", () => {
    const url = buildWhatsAppUrl("Hello");
    expect(url).toMatch(/^https:\/\/wa\.me\//);
  });

  it("appends encoded text as query param", () => {
    const url = buildWhatsAppUrl("Hello World");
    expect(url).toContain(`?text=${encodeURIComponent("Hello World")}`);
  });

  it("encodes special characters in message text", () => {
    const url = buildWhatsAppUrl("I'm interested");
    expect(url).toContain(encodeURIComponent("I'm interested"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/config/__tests__/whatsapp.test.ts
```

Expected: FAIL — "Cannot find module '../whatsapp'"

- [ ] **Step 3: Write the implementation**

Create `src/lib/config/whatsapp.ts`:
```typescript
export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "
  ";

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/config/__tests__/whatsapp.test.ts
```

Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/whatsapp.ts src/lib/config/__tests__/whatsapp.test.ts
git commit -m "feat: add whatsapp config module with buildWhatsAppUrl helper"
```

---

### Task 3: Create the WhatsAppButton component

**Files:**
- Create: `src/components/layout/WhatsAppButton.tsx`

No automated component test — vitest is configured for `environment: "node"` with no React Testing Library installed; component rendering tests are out of scope for this project.

- [ ] **Step 1: Create the component**

Create `src/components/layout/WhatsAppButton.tsx`:
```tsx
"use client";

import { buildWhatsAppUrl } from "@/lib/config/whatsapp";

const STORE_GREETING = "Hi, I'd like to learn more about your bridal collection.";

export default function WhatsAppButton() {
  return (
    <a
      href={buildWhatsAppUrl(STORE_GREETING)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] shadow-lg transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="white"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.982L2 22l5.233-1.371a9.994 9.994 0 0 0 4.779 1.209c5.505 0 9.988-4.479 9.99-9.987A9.994 9.994 0 0 0 12.012 2Zm4.877 14.224c-.274.773-1.332 1.396-1.84 1.442-.469.043-.918.23-2.986-.593-2.647-1.053-4.32-3.779-4.453-3.955-.13-.177-1.07-1.428-1.07-2.723 0-1.294.673-1.929.914-2.19.24-.262.529-.326.705-.326.177 0 .354.001.508.008.16.007.375-.06.586.447.218.522.747 1.821.811 1.952.064.13.107.283.02.457-.086.174-.13.283-.26.435-.13.153-.274.34-.39.457-.13.13-.267.272-.116.533.152.26.678 1.117 1.453 1.808.998.89 1.839 1.166 2.099 1.296.26.13.412.109.564-.065.152-.174.652-.761.826-1.022.174-.261.347-.217.585-.13.24.086 1.52.717 1.78.847.26.13.435.195.499.304.065.109.065.631-.208 1.405Z" />
      </svg>
    </a>
  );
}
```

Sizing note: `h-14 w-14` = 3.5rem = 56px. `bg-[#25d366]` matches the spec's `#25D366`.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/WhatsAppButton.tsx
git commit -m "feat: add WhatsAppButton floating component"
```

---

### Task 4: Mount WhatsAppButton in the root layout

**Files:**
- Modify: `src/app/layout.tsx`

The root layout is a Server Component. Importing a Client Component into it is the standard RSC composition pattern — Next.js handles the boundary automatically.

- [ ] **Step 1: Add the import and render `<WhatsAppButton />`**

Edit `src/app/layout.tsx` to match this exactly:
```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PromoStrip from "@/components/layout/PromoStrip";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MEI Bridal Couture — Handcrafted Elegance",
  description:
    "Premium Indian bridal wear — Lehengas, Sarees, and Bespoke Couture. Handcrafted with Aari, Zardosi, and Mirror embroidery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-[#1A1A1A] antialiased">
        <PromoStrip />
        <Header />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: mount WhatsAppButton in root layout"
```

---

### Task 5: Refactor ProductDetailClient to use the config module

**Files:**
- Modify: `src/components/product/ProductDetailClient.tsx`

- [ ] **Step 1: Replace the hardcoded wa.me URL with `buildWhatsAppUrl`**

Rewrite `src/components/product/ProductDetailClient.tsx` in full:
```tsx
"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart";
import { buildWhatsAppUrl } from "@/lib/config/whatsapp";
import type { Product } from "@/types";

interface Props {
  product: Product;
}

export default function ProductDetailClient({ product }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] ?? product.image_url ?? "",
      work_types: product.work_types,
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="space-y-3 pt-6">
      <button
        onClick={handleAddToCart}
        className="w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer text-center"
      >
        {isAdded ? "Added to Cart" : "Add to Cart"}
      </button>
      <a
        href={buildWhatsAppUrl(`Hi, I'm interested in inquiring about ${product.name}.`)}
        target="_blank"
        rel="noreferrer"
        className="w-full border border-[#25d366] text-[#25d366] hover:bg-[#25d366]/5 py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.982L2 22l5.233-1.371a9.994 9.994 0 0 0 4.779 1.209c5.505 0 9.988-4.479 9.99-9.987A9.994 9.994 0 0 0 12.012 2Zm4.877 14.224c-.274.773-1.332 1.396-1.84 1.442-.469.043-.918.23-2.986-.593-2.647-1.053-4.32-3.779-4.453-3.955-.13-.177-1.07-1.428-1.07-2.723 0-1.294.673-1.929.914-2.19.24-.262.529-.326.705-.326.177 0 .354.001.508.008.16.007.375-.06.586.447.218.522.747 1.821.811 1.952.064.13.107.283.02.457-.086.174-.13.283-.26.435-.13.153-.274.34-.39.457-.13.13-.267.272-.116.533.152.26.678 1.117 1.453 1.808.998.89 1.839 1.166 2.099 1.296.26.13.412.109.564-.065.152-.174.652-.761.826-1.022.174-.261.347-.217.585-.13.24.086 1.52.717 1.78.847.26.13.435.195.499.304.065.109.065.631-.208 1.405Z" />
        </svg>
        WhatsApp Inquiry
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (including the 3 new whatsapp config tests)

- [ ] **Step 3: Commit**

```bash
git add src/components/product/ProductDetailClient.tsx
git commit -m "refactor: use buildWhatsAppUrl in ProductDetailClient"
```
