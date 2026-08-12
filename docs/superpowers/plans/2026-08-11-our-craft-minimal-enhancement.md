# Our Craft Minimal Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a very light, feature-flagged scroll depth + soft shadow enhancement to the homepage "Our Craft" 3x2 card grid, without touching anything else on the site.

**Architecture:** A new isolated `components/features/crafts-v2/` module exposes `EnhancedCraftsGridContainer`, a Server Component that renders the exact legacy markup for `mode="base"` (the rollback/default, single source of truth for the old grid) or delegates to a Client Component, `CreativeCraftsGrid`, for `mode="minimal"`. `CreativeCraftsGrid` renders one `CraftCard` per item; each card uses Framer Motion's `useScroll`/`useTransform` scoped to its own ref to move only its image layer ±8px, and a CSS Module supplies the soft ambient shadow and its very slight hover deepening. Hover in minimal mode is restricted to a small image scale only — no underline animation, no text translate. `page.tsx` swaps its inline grid `<div>` for `<EnhancedCraftsGridContainer mode="minimal" items={crafts} />` — nothing else in `page.tsx` changes except that one block and the import line.

**Tech Stack:** Next.js 16 (App Router, React 19 Server + Client Components), TypeScript strict mode, Tailwind CSS v4 (utility classes, no config changes), CSS Modules (scoped to this feature only), Framer Motion (new dependency — required by spec, not currently installed).

## Global Constraints

- Only touch: new files under `src/components/features/crafts-v2/`, `src/app/page.tsx` (import line + one JSX block), and `package.json`/`package-lock.json` (framer-motion dependency add — genuinely absent from the repo today). Nothing else.
- Never edit `globals.css`, `tailwind.config.*`, `app/layout.*`, `providers/*`, navigation, footer, or any component outside `crafts-v2`.
- No global CSS selectors (`body {}`, `img {}`, `section {}`, etc.) anywhere — all new styles live in `CreativeCraftsGrid.module.css` and are class-scoped.
- `CraftsMode` has exactly two values: `"base" | "minimal"`. No `"parallax"` mode.
- Image vertical scroll movement: -8px → 0 → +8px, absolute max ±10px. No rotation, no skew. Max hover scale 1.015. The card container itself never moves and stays in normal document flow.
- Hover transition duration 500–800ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Minimal-mode hover is image-scale only — do **not** carry over the legacy hover's animated underline (`w-0 → w-full` bar) or the text `group-hover:translate-y-[-4px]`; those stay only in `base` mode's untouched legacy markup.
- Shadow values: resting `0 10px 24px -18px rgba(13, 13, 17, 0.22)`; hover-capable devices only, very slightly deeper: `0 14px 30px -18px rgba(13, 13, 17, 0.28)`. Soft, low-opacity, broad blur — no neon, no color, no heavy black shadow.
- Breathing space: do **not** reflexively change the card grid gap (`gap-6` stays `gap-6` in both modes). The existing heading→paragraph (`space-y-4`), paragraph→grid (`space-y-12`), and section padding (`py-24`) already match the sibling "Shop by Category" section's spacing one section above, so this plan makes no spacing changes — there is no visual evidence of the section being packed. If a spacing change is later found necessary, prioritize heading→description, then description→grid, then section top/bottom padding, in that order, before ever touching card-to-card gap.
- Respect `prefers-reduced-motion`: disable scroll translate and hover scale; keep the static image, shadow, and layout.
- Disable hover-only effects on touch devices (`(hover: hover) and (pointer: fine)` gate) — no continuous-updating React state from pointer movement.
- No Canvas, no WebGL, no particles, no custom cursor, no rAF loops, no manually-managed persistent listeners (Framer Motion's internal scroll listener is acceptable — it self-cleans on unmount).
- Preserve the six existing image paths, labels, `object-fit`/`object-position`/crop, and the dark bottom gradient overlay exactly.
- Any non-interactive overlay layer must carry `pointer-events: none`; no fixed-position or full-page overlay; no z-index that could sit above navigation or floating widgets.
- This repo has no component-testing setup (`vitest` config runs with `environment: "node"`, no `@testing-library/react` installed) and adding one would violate "no unnecessary dependency changes" / "do not create unnecessary test infrastructure" — so no `__tests__` directory is created. Verification is TypeScript, ESLint, production build, and manual/Playwright-driven browser checks (Playwright is already a devDependency), not unit tests.

---

## File Structure

- `src/components/features/crafts-v2/crafts.types.ts` — shared `CraftItem` and `CraftsMode` types.
- `src/components/features/crafts-v2/EnhancedCraftsGridContainer.tsx` — Server Component feature-flag switch; owns the legacy (`base`) markup verbatim as its single source of truth; delegates to `CreativeCraftsGrid` for `minimal`.
- `src/components/features/crafts-v2/CreativeCraftsGrid.tsx` — Client Component; renders the grid and a `CraftCard` per item with scroll parallax, hover polish, and shadow class.
- `src/components/features/crafts-v2/CreativeCraftsGrid.module.css` — scoped shadow/depth styles.
- `src/app/page.tsx` — modify: import `EnhancedCraftsGridContainer`, replace the inline crafts grid `<div>` with the container.

---

### Task 1: Add Framer Motion dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (generated by install)

**Interfaces:**
- Produces: `framer-motion` package available for import as `motion`, `useScroll`, `useTransform`, `useReducedMotion` in later tasks.

- [ ] **Step 1: Install the package**

Run: `npm install framer-motion`
Expected: `package.json` gains a `"framer-motion": "^<version>"` entry under `dependencies`, `package-lock.json` updates, exit code 0.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "require.resolve('framer-motion')"`
Expected: prints the resolved path, no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion for Our Craft scroll enhancement"
```

---

### Task 2: Create shared types

**Files:**
- Create: `src/components/features/crafts-v2/crafts.types.ts`

**Interfaces:**
- Produces: `CraftItem { label: string; image: string }`, `CraftsMode = "base" | "minimal"` — consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the file**

```typescript
// src/components/features/crafts-v2/crafts.types.ts
export type CraftItem = {
  label: string;
  image: string;
};

export type CraftsMode = "base" | "minimal";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `crafts.types.ts` (other pre-existing repo errors, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add src/components/features/crafts-v2/crafts.types.ts
git commit -m "feat(crafts-v2): add shared craft item and mode types"
```

---

### Task 3: Create the shadow/depth CSS Module

**Files:**
- Create: `src/components/features/crafts-v2/CreativeCraftsGrid.module.css`

**Interfaces:**
- Produces: `.card` (soft ambient shadow + hover-only deepen, hover-capable devices only), `.imageWrap` (absolute, overflow-hidden parallax layer) — consumed by Task 4.

- [ ] **Step 1: Write the file**

```css
/* src/components/features/crafts-v2/CreativeCraftsGrid.module.css */
.card {
  box-shadow: 0 10px 24px -18px rgba(13, 13, 17, 0.22);
  transition: box-shadow 650ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (hover: hover) and (pointer: fine) {
  .card:hover {
    box-shadow: 0 14px 30px -18px rgba(13, 13, 17, 0.28);
  }
}

.imageWrap {
  position: absolute;
  left: 0;
  right: 0;
  overflow: hidden;
}
```

- [ ] **Step 2: Confirm no global leakage**

Run: `grep -nE "^(body|html|\*|img|h1|h2|section)\s*\{" src/components/features/crafts-v2/CreativeCraftsGrid.module.css`
Expected: no output (empty match) — confirms no bare global selectors were introduced.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/crafts-v2/CreativeCraftsGrid.module.css
git commit -m "feat(crafts-v2): add scoped shadow/depth styles"
```

---

### Task 4: Create CreativeCraftsGrid (minimal-mode renderer)

**Files:**
- Create: `src/components/features/crafts-v2/CreativeCraftsGrid.tsx`

**Interfaces:**
- Consumes: `CraftItem` from `./crafts.types`; `.card`/`.imageWrap` from `./CreativeCraftsGrid.module.css`; `framer-motion`'s `motion`, `useScroll`, `useTransform`, `useReducedMotion`.
- Produces: `export default function CreativeCraftsGrid(props: { items: CraftItem[] })` — consumed by Task 5. Also exports the constants `SCROLL_RANGE_PX = 8` and `HOVER_SCALE = 1.015` for reference (not required by consumers).

- [ ] **Step 1: Write the file**

```tsx
// src/components/features/crafts-v2/CreativeCraftsGrid.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { CraftItem } from "./crafts.types";
import styles from "./CreativeCraftsGrid.module.css";

export const SCROLL_RANGE_PX = 8;
export const HOVER_SCALE = 1.015;

type CreativeCraftsGridProps = {
  items: CraftItem[];
};

export default function CreativeCraftsGrid({ items }: CreativeCraftsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((craft, idx) => (
        <CraftCard key={idx} craft={craft} />
      ))}
    </div>
  );
}

function CraftCard({ craft }: { craft: CraftItem }) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });

  const rawY = useTransform(scrollYProgress, [0, 1], [-SCROLL_RANGE_PX, SCROLL_RANGE_PX]);
  const y = useTransform(rawY, (value) => (prefersReducedMotion ? 0 : value));

  const hoverEnabled = canHover && !prefersReducedMotion;

  return (
    <Link
      ref={cardRef}
      href="/shop"
      className={`group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden border border-[#e8e0d5]/10 bg-[#1a1a1a] ${styles.card}`}
    >
      <motion.div
        className={styles.imageWrap}
        style={{
          top: -SCROLL_RANGE_PX,
          bottom: -SCROLL_RANGE_PX,
          y,
          translateZ: 0,
          willChange: "transform",
        }}
        whileHover={hoverEnabled ? { scale: HOVER_SCALE } : undefined}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        {craft.image && (
          <Image
            src={craft.image}
            alt={craft.label}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

      <div className="text-center z-10">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90">
          {craft.label}
        </span>
      </div>
    </Link>
  );
}
```

Note what's deliberately absent versus the legacy markup: no `group-hover:opacity-90` on the gradient, no `group-hover:translate-y-[-4px]` on the text block, and no animated underline `<div>` — Phase 8 of the spec explicitly asks for these to be removed from the enhanced version. The image scale-on-hover is the only interactive polish.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `CreativeCraftsGrid.tsx`.

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/components/features/crafts-v2/CreativeCraftsGrid.tsx`
Expected: no errors (warnings only if pre-existing repo-wide rules produce them elsewhere — none expected here).

- [ ] **Step 4: Commit**

```bash
git add src/components/features/crafts-v2/CreativeCraftsGrid.tsx
git commit -m "feat(crafts-v2): add minimal-mode scroll grid with hover polish"
```

---

### Task 5: Create EnhancedCraftsGridContainer (feature-flag switch)

**Files:**
- Create: `src/components/features/crafts-v2/EnhancedCraftsGridContainer.tsx`

**Interfaces:**
- Consumes: `CraftItem`, `CraftsMode` from `./crafts.types`; `CreativeCraftsGrid` (default export) from `./CreativeCraftsGrid`.
- Produces: `export default function EnhancedCraftsGridContainer(props: { mode?: CraftsMode; items?: CraftItem[] })`, default `mode = "base"` — consumed by Task 6.

- [ ] **Step 1: Write the file**

```tsx
// src/components/features/crafts-v2/EnhancedCraftsGridContainer.tsx
import Link from "next/link";
import Image from "next/image";
import CreativeCraftsGrid from "./CreativeCraftsGrid";
import type { CraftItem, CraftsMode } from "./crafts.types";

type EnhancedCraftsGridContainerProps = {
  mode?: CraftsMode;
  items?: CraftItem[];
};

export default function EnhancedCraftsGridContainer({
  mode = "base",
  items = [],
}: EnhancedCraftsGridContainerProps) {
  if (mode === "minimal") {
    return <CreativeCraftsGrid items={items} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((craft, idx) => (
        <Link
          key={idx}
          href="/shop"
          className="group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden border border-[#e8e0d5]/10 bg-[#1a1a1a]"
        >
          {craft.image && (
            <Image
              src={craft.image}
              alt={craft.label}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
          <div className="text-center z-10 transition-transform duration-500 group-hover:translate-y-[-4px]">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
              {craft.label}
            </span>
            <div className="w-0 h-[1px] bg-white/50 mx-auto mt-2 transition-all duration-500 group-hover:w-full" />
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `EnhancedCraftsGridContainer.tsx`.

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/components/features/crafts-v2/EnhancedCraftsGridContainer.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/crafts-v2/EnhancedCraftsGridContainer.tsx
git commit -m "feat(crafts-v2): add base/minimal feature-flag container"
```

---

### Task 6: Wire into the homepage

**Files:**
- Modify: `src/app/page.tsx:15-18` (imports), `src/app/page.tsx:155-185` (crafts grid block)

**Interfaces:**
- Consumes: `EnhancedCraftsGridContainer` default export from `@/components/features/crafts-v2/EnhancedCraftsGridContainer`; the existing local `crafts: CraftItem[]` array already declared at `src/app/page.tsx:23-30`.

- [ ] **Step 1: Add the import**

In `src/app/page.tsx`, after the existing `import { getCategories } from "@/lib/services/categories";` line (line 18), add:

```tsx
import EnhancedCraftsGridContainer from "@/components/features/crafts-v2/EnhancedCraftsGridContainer";
```

- [ ] **Step 2: Replace the inline grid block**

Replace this block (currently `src/app/page.tsx:155-185`):

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {crafts.map((craft, idx) => (
              <Link
                key={idx}
                href="/shop"
                className="group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden border border-[#e8e0d5]/10 bg-[#1a1a1a]"
              >
                {/* 1. The Actual Image Component */}
                {craft.image && (
                  <Image
                    src={craft.image}
                    alt={craft.label}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                )}

                {/* 2. Dark Overlay (Crucial so white text is readable over light images) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-90" />

                {/* 3. Text Label */}
                <div className="text-center z-10 transition-transform duration-500 group-hover:translate-y-[-4px]">
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
                    {craft.label}
                  </span>
                  <div className="w-0 h-[1px] bg-white/50 mx-auto mt-2 transition-all duration-500 group-hover:w-full" />
                </div>
              </Link>
            ))}
          </div>
```

with:

```tsx
          <EnhancedCraftsGridContainer mode="minimal" items={crafts} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors (repo-wide, since `page.tsx` is a shared entry point).

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: build succeeds, exit code 0, no hydration/type errors, `/` route compiled.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): wire minimal Our Craft scroll/shadow enhancement into homepage"
```

---

### Task 7: File isolation audit, DOM/lifecycle verification, and final QA

**Files:**
- None created/modified — verification only.

**Interfaces:**
- None.

- [ ] **Step 1: File isolation audit**

Run: `git diff --stat main...HEAD`
Expected: only these paths appear: `package.json`, `package-lock.json`, `src/app/page.tsx`, `src/components/features/crafts-v2/crafts.types.ts`, `src/components/features/crafts-v2/EnhancedCraftsGridContainer.tsx`, `src/components/features/crafts-v2/CreativeCraftsGrid.tsx`, `src/components/features/crafts-v2/CreativeCraftsGrid.module.css`. If anything else appears (globals.css, tailwind.config.*, layout, providers, navigation, footer, unrelated components/pages) — STOP and investigate before continuing.

- [ ] **Step 2: Start the dev server and visually verify**

Run: `npm run dev` (background)
Then open `http://localhost:3000/` in a browser (use the `example-skills:webapp-testing` Playwright toolkit if available) and check against the Phase 16 acceptance criteria: ivory background unchanged, typography unchanged, six images unchanged, 3x2 desktop / 2-col tablet / 1-col mobile structure preserved, subtle scroll movement on the card images, subtle ambient card shadow, no layout shift, no horizontal overflow, WhatsApp widget and any other floating widget still clickable and unaffected.

- [ ] **Step 3: DOM regression measurement**

Using Playwright (already a devDependency), navigate to `/`, capture `getBoundingClientRect()` for the header, the Our Craft `<section>`, the next sibling section, and the footer, both with `mode="base"` (temporarily) and `mode="minimal"` (as wired). Compare `x`, `y`, `width`, `height` for all four elements — since this revision makes no spacing changes (grid gap stays `gap-6` in both modes, and section/heading/paragraph spacing is untouched), the Our Craft section's own box, not just its neighbors, is expected to measure identically between `base` and `minimal`. Report exact PASS/FAIL per element. Do not fabricate numbers — if Playwright cannot be run in this environment, report `NOT VERIFIED — runtime browser measurement required` explicitly instead of guessing.

- [ ] **Step 4: Lifecycle check**

In the same Playwright session, mount and then navigate away from `/` (unmounting the Craft section), and confirm via `page.evaluate` that no custom `window.addEventListener` calls were made by this feature (Framer Motion's internal scroll tracking is exempt — it self-cleans on unmount). Confirm no `requestAnimationFrame` loop and no timers were registered by this code (search the built output or watch `window` listener counts before/after navigation).

- [ ] **Step 5: Reduced motion check**

With `prefers-reduced-motion: reduce` emulated (Playwright `page.emulateMedia({ reducedMotion: 'reduce' })` or OS setting), reload `/` and confirm the card images no longer move on scroll and no longer scale on hover, while the ambient shadow is still present.

- [ ] **Step 6: Final full QA pass**

Run in sequence:
```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```
Expected: all four succeed with exit code 0. Report each result plainly (PASS/FAIL); do not mark the work `PRODUCTION-GRADE` unless every applicable check in Phase 16/21 genuinely passed, and call out anything reported as `NOT VERIFIED`.

- [ ] **Step 7: Commit (only if Step 6 uncovered fixes)**

If any fixes were needed during QA, stage exactly the touched files and commit:

```bash
git add <touched files>
git commit -m "fix(crafts-v2): address QA findings"
```
