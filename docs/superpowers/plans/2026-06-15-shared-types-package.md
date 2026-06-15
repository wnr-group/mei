# Shared Types Package: @mei/shared-types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `database.ts` into a standalone `@mei/shared-types` package so both `mei-admin` and `mei` always import from a single canonical source — no more manual copy-sync.

**Architecture:** Create `packages/shared-types/` as a local npm package referenced via `file:` protocol in both apps. No npm workspaces or monorepo root setup required (WNR root already has an unrelated `package.json`). After `npm install`, both apps resolve `@mei/shared-types` through their own `node_modules/` as normal. Both apps' existing `database.ts` files become thin re-exports from the package.

**Tech Stack:** npm `file:` dependencies, TypeScript, Next.js 16 (both apps)

**Prerequisite:** The type-alignment plan (`2026-06-15-type-alignment.md`) should be executed first. This plan assumes `mei/src/lib/supabase/database.ts` already exists as a copy of `mei-admin/types/database.ts`.

---

## File Map

| Action | Path |
|---|---|
| Create | `packages/shared-types/package.json` |
| Create | `packages/shared-types/database.ts` |
| Create | `packages/shared-types/index.ts` |
| Modify | `mei-admin/package.json` |
| Modify | `mei/package.json` |
| Replace | `mei-admin/types/database.ts` → re-export |
| Replace | `mei/src/lib/supabase/database.ts` → re-export |

> All paths are relative to `C:\Users\Eshwar Paygude\WNR\` (the WNR workspace root, one level above `mei/` and `mei-admin/`).

---

### Task 1: Create the shared-types package

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/database.ts`
- Create: `packages/shared-types/index.ts`

> **Context:** This is a types-only package — no runtime code, no build step, no transpilePackages needed. The `main` field points at the source TypeScript directly (`index.ts`). Both Next.js apps use `moduleResolution: "bundler"` which resolves TypeScript source natively.

- [ ] **Step 1: Create `packages/shared-types/package.json`**

  Create `C:\Users\Eshwar Paygude\WNR\packages\shared-types\package.json`:

  ```json
  {
    "name": "@mei/shared-types",
    "version": "1.0.0",
    "private": true,
    "main": "index.ts",
    "types": "index.ts"
  }
  ```

- [ ] **Step 2: Create `packages/shared-types/database.ts`**

  Copy the full content of `mei-admin/types/database.ts` verbatim into `packages/shared-types/database.ts`.

  The file content (as of the type-alignment plan) is:

  ```typescript
  export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

  export type Database = {
    public: {
      Tables: {
        profiles: {
          Row: { id: string; role: 'admin' | 'super_admin'; full_name: string | null; created_at: string }
          Insert: { id: string; role?: 'admin' | 'super_admin'; full_name?: string | null }
          Update: { role?: 'admin' | 'super_admin'; full_name?: string | null }
        }
        categories: {
          Row: { id: string; name: string; slug: string; subtitle: string | null; description: string | null; image_url: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string; deleted_at: string | null }
          Insert: { id?: string; name: string; slug: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number }
          Update: { name?: string; slug?: string; subtitle?: string | null; description?: string | null; image_url?: string | null; is_active?: boolean; sort_order?: number; deleted_at?: string | null }
        }
        products: {
          Row: { id: string; name: string; slug: string | null; short_description: string | null; category_id: string | null; price: number; work_types: string[]; status: 'PUBLISHED' | 'DRAFT'; description: string | null; image_url: string | null; created_at: string; updated_at: string; deleted_at: string | null }
          Insert: { id?: string; name: string; slug?: string | null; short_description?: string | null; category_id?: string | null; price: number; work_types?: string[]; status?: 'PUBLISHED' | 'DRAFT'; description?: string | null; image_url?: string | null }
          Update: { name?: string; slug?: string | null; short_description?: string | null; category_id?: string | null; price?: number; work_types?: string[]; status?: 'PUBLISHED' | 'DRAFT'; description?: string | null; image_url?: string | null; deleted_at?: string | null }
        }
        customers: {
          Row: { id: string; name: string; email: string | null; phone: string | null; city: string | null; created_at: string }
          Insert: { id?: string; name: string; email?: string | null; phone?: string | null; city?: string | null }
          Update: { name?: string; email?: string | null; phone?: string | null; city?: string | null }
        }
        orders: {
          Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string }
          Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null }
          Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null }
        }
        order_items: {
          Row: { id: string; order_id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; created_at: string }
          Insert: { id?: string; order_id: string; product_id?: string | null; product_name: string; quantity?: number; unit_price: number }
          Update: { quantity?: number; unit_price?: number }
        }
        product_media: {
          Row: { id: string; product_id: string; color_id: string | null; variant_id: string | null; url: string; alt_text: string | null; is_primary: boolean; media_type: 'IMAGE' | 'VIDEO'; thumbnail_url: string | null; video_provider: string | null; sort_order: number; created_by: string | null; created_at: string; deleted_at: string | null }
          Insert: { id?: string; product_id: string; color_id?: string | null; variant_id?: string | null; url: string; alt_text?: string | null; is_primary?: boolean; media_type?: 'IMAGE' | 'VIDEO'; thumbnail_url?: string | null; video_provider?: string | null; sort_order?: number; created_by?: string | null }
          Update: { url?: string; alt_text?: string | null; is_primary?: boolean; media_type?: 'IMAGE' | 'VIDEO'; thumbnail_url?: string | null; sort_order?: number; deleted_at?: string | null }
        }
        enquiries: {
          Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
          Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
          Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null }
        }
        banners: {
          Row: { id: string; title: string; image_url: string; link_url: string | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string; deleted_at: string | null }
          Insert: { id?: string; title: string; image_url: string; link_url?: string | null; is_active?: boolean; sort_order?: number }
          Update: { title?: string; image_url?: string; link_url?: string | null; is_active?: boolean; sort_order?: number; deleted_at?: string | null }
        }
        settings: {
          Row: { key: string; value: unknown; description: string | null; updated_at: string; updated_by: string | null }
          Insert: { key: string; value: unknown; description?: string | null; updated_by?: string | null }
          Update: { value?: unknown; description?: string | null; updated_by?: string | null }
        }
        audit_logs: {
          Row: { id: string; admin_id: string | null; action: string; resource_type: string; resource_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; user_agent: string | null; session_id: string | null; created_at: string }
          Insert: { id?: string; admin_id?: string | null; action: string; resource_type: string; resource_id?: string | null; old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null; user_agent?: string | null; session_id?: string | null }
          Update: never
        }
      }
      Enums: {
        admin_role: 'admin' | 'super_admin'
        order_status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
        product_status: 'PUBLISHED' | 'DRAFT'
        enquiry_status: 'NEW' | 'REPLIED' | 'CLOSED'
        media_type: 'IMAGE' | 'VIDEO'
      }
    }
  }
  ```

- [ ] **Step 3: Create `packages/shared-types/index.ts`**

  Create `C:\Users\Eshwar Paygude\WNR\packages\shared-types\index.ts`:

  ```typescript
  export type { Json, Database } from "./database";
  ```

- [ ] **Step 4: Commit the package**

  ```bash
  git add packages/shared-types/
  git commit -m "feat: add @mei/shared-types package with canonical database types"
  ```

  > **Note:** If `packages/` is outside any existing git repo, run `git init` first inside the WNR root or ensure it is tracked by an existing repo. If `mei/` and `mei-admin/` are the same git repo with a root at `WNR/`, the add command above works as-is.

---

### Task 2: Install the package in both apps

**Files:**
- Modify: `mei-admin/package.json`
- Modify: `mei/package.json`

> **Context:** The `file:` protocol tells npm to link the package from the local filesystem. After `npm install`, `node_modules/@mei/shared-types` in each app is a symlink to `packages/shared-types/`. No registry publish needed.

- [ ] **Step 1: Add dependency to mei-admin**

  In `mei-admin/package.json`, add to the `"dependencies"` section:

  ```json
  "@mei/shared-types": "file:../packages/shared-types"
  ```

  The `dependencies` block after the change:
  ```json
  "dependencies": {
    "@mei/shared-types": "file:../packages/shared-types",
    "@sentry/nextjs": "^10.57.0",
    "@supabase/ssr": "^0.12.0",
    "@supabase/supabase-js": "^2.108.0",
    "@tanstack/react-query": "^5.101.0",
    "lucide-react": "^1.17.0",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  }
  ```

- [ ] **Step 2: Add dependency to mei storefront**

  In `mei/package.json`, add to the `"dependencies"` section:

  ```json
  "@mei/shared-types": "file:../packages/shared-types"
  ```

  The `dependencies` block after the change:
  ```json
  "dependencies": {
    "@mei/shared-types": "file:../packages/shared-types",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.106.1",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zustand": "^5.0.13"
  }
  ```

- [ ] **Step 3: Install in mei-admin**

  ```bash
  cd mei-admin
  npm install
  ```

  Expected: `added 1 package` (or similar), `node_modules/@mei/shared-types` symlink created.

  Verify:
  ```bash
  ls node_modules/@mei/shared-types/
  ```
  Expected: `package.json  database.ts  index.ts`

- [ ] **Step 4: Install in mei**

  ```bash
  cd mei
  npm install
  ```

  Expected: same as Step 3.

  Verify:
  ```bash
  ls node_modules/@mei/shared-types/
  ```
  Expected: `package.json  database.ts  index.ts`

- [ ] **Step 5: Commit package.json changes**

  ```bash
  git add mei-admin/package.json mei/package.json
  git commit -m "chore: add @mei/shared-types file: dependency to both apps"
  ```

---

### Task 3: Replace mei-admin's database.ts with re-export

**Files:**
- Modify: `mei-admin/types/database.ts`

> **Context:** `mei-admin/types/database.ts` currently contains the full type definitions inline. Replace it with a re-export from the package. `mei-admin/types/index.ts` imports from `./database` and stays unchanged — it still gets all types through the re-export chain.

- [ ] **Step 1: Replace the full content of `mei-admin/types/database.ts`**

  Replace the entire file with:

  ```typescript
  export type { Json, Database } from "@mei/shared-types";
  ```

- [ ] **Step 2: Verify mei-admin TypeScript**

  ```bash
  cd mei-admin
  npx tsc --noEmit
  ```

  Expected: 0 errors, no output.

  If you see `Cannot find module '@mei/shared-types'`: run `npm install` again from `mei-admin/`.

- [ ] **Step 3: Commit**

  ```bash
  git add mei-admin/types/database.ts
  git commit -m "refactor: replace inline database.ts with re-export from @mei/shared-types"
  ```

---

### Task 4: Replace storefront's database.ts with re-export

**Files:**
- Modify: `mei/src/lib/supabase/database.ts`

> **Context:** `mei/src/lib/supabase/database.ts` was created in the type-alignment plan as a copy. Replace it with a re-export. `mei/src/types/index.ts` imports from `"@/lib/supabase/database"` and stays unchanged.

- [ ] **Step 1: Replace the full content of `mei/src/lib/supabase/database.ts`**

  Replace the entire file with:

  ```typescript
  export type { Json, Database } from "@mei/shared-types";
  ```

- [ ] **Step 2: Verify storefront TypeScript**

  ```bash
  cd mei
  npx tsc --noEmit
  ```

  Expected: 0 errors, no output.

  If you see `Cannot find module '@mei/shared-types'`: run `npm install` again from `mei/`.

- [ ] **Step 3: Commit**

  ```bash
  git add mei/src/lib/supabase/database.ts
  git commit -m "refactor: replace inline database.ts with re-export from @mei/shared-types"
  ```

---

### Task 5: Final verification

**Files:** (read-only verification)

> **Context:** Confirm the full chain: `@mei/shared-types` → `types/database.ts` → `types/index.ts` → components. Both apps should build cleanly. When `supabase gen types` is run in future, update `packages/shared-types/database.ts` only, and both apps pick up the change.

- [ ] **Step 1: Confirm the import chain in mei-admin**

  ```bash
  cd mei-admin
  node -e "
    const path = require('path');
    const pkg = require('@mei/shared-types/package.json');
    console.log('Package found at:', require.resolve('@mei/shared-types/package.json'));
    console.log('Name:', pkg.name, '| Version:', pkg.version);
  "
  ```

  Expected output:
  ```
  Package found at: .../node_modules/@mei/shared-types/package.json
  Name: @mei/shared-types | Version: 1.0.0
  ```

- [ ] **Step 2: Confirm the import chain in mei**

  Same command from `mei/`:
  ```bash
  cd mei
  node -e "
    const pkg = require('@mei/shared-types/package.json');
    console.log('Package found at:', require.resolve('@mei/shared-types/package.json'));
    console.log('Name:', pkg.name, '| Version:', pkg.version);
  "
  ```

  Expected: same output as Step 1.

- [ ] **Step 3: Type-check both apps**

  ```bash
  cd mei-admin && npx tsc --noEmit && echo "mei-admin: ✓ 0 errors"
  cd mei && npx tsc --noEmit && echo "mei: ✓ 0 errors"
  ```

  Expected:
  ```
  mei-admin: ✓ 0 errors
  mei: ✓ 0 errors
  ```

- [ ] **Step 4: Document the supabase gen types workflow**

  Add this comment block at the top of `packages/shared-types/database.ts`:

  ```typescript
  // SINGLE SOURCE OF TRUTH for MEI database types.
  // To regenerate after a Supabase migration:
  //   cd mei-admin
  //   supabase gen types typescript --project-id hjhqemsyufsifmgespur > ../packages/shared-types/database.ts
  // Both apps pick up the change on their next build (no manual copy needed).
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/shared-types/database.ts
  git commit -m "docs: add supabase gen types workflow comment to shared database.ts"
  ```

---

## Self-Review

**Spec coverage:**
- [x] `packages/shared-types/database.ts` created → Task 1 Step 2
- [x] Admin imports from `@mei/shared-types` → Task 3
- [x] Storefront imports from `@mei/shared-types` → Task 4
- [x] Single source of truth documented → Task 5 Step 4

**Placeholder scan:** All steps have exact file contents and commands. No TBDs.

**Type consistency:** The `Database` type exported from `packages/shared-types/index.ts` → `database.ts` is the same type consumed by `mei-admin/types/index.ts` (via `./database`) and `mei/src/types/index.ts` (via `@/lib/supabase/database`). The re-export chain does not alter the type — it passes through transparently.

**Important:** The `mei-admin/package-lock.json` and `mei/package-lock.json` will both update after `npm install`. Commit them:
```bash
git add mei-admin/package-lock.json mei/package-lock.json
git commit -m "chore: update lock files after @mei/shared-types install"
```
