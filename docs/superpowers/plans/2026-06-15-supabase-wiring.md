# Supabase Wiring: Connect Storefront to Shared Instance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `mei` (storefront) to the same remote Supabase project the admin uses, proving connectivity with a live server-side query.

**Architecture:** Copy env credentials from `mei-admin/.env.local` into a new `mei/.env.local`. Add an anon-safe RLS policy so the storefront's anon key can actually read published products. Create a single `/api/db-ping` route as the connectivity proof.

**Tech Stack:** Next.js 16 App Router Route Handlers, `@supabase/ssr` server client, Supabase Postgres RLS

---

## File Map

| Action | Path |
|--------|------|
| Create | `mei/.env.local` |
| Create | `mei/.env.example` |
| Create | `mei-admin/supabase/migrations/20260615_storefront_public_read.sql` |
| Create | `mei/src/app/api/db-ping/route.ts` |

---

### Task 1: Create environment files

**Files:**
- Create: `mei/.env.local`
- Create: `mei/.env.example`

> **Context:** The admin's `.env.local` already has the correct remote Supabase credentials at `https://hjhqemsyufsifmgespur.supabase.co`. The storefront needs the same URL and anon key. The service role key must NOT go here — it's admin-only.

- [ ] **Step 1: Create `mei/.env.local`**

  Create the file `mei/.env.local` with this exact content (values copied from `mei-admin/.env.local`):

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://hjhqemsyufsifmgespur.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqaHFlbXN5dWZzaWZtZ2VzcHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTYzMDksImV4cCI6MjA5NjU3MjMwOX0.C3q3hCrcbdKxDmvCpEzAZ4sO3AKXXdfAVE6fq4E7M_g
  ```

  Do NOT add `SUPABASE_SERVICE_ROLE_KEY` — the storefront uses the anon key only.

- [ ] **Step 2: Create `mei/.env.example`**

  Create the file `mei/.env.example` with placeholder values for developer onboarding:

  ```
  # Supabase project (get from: Dashboard → Project Settings → API)
  # Both storefront and admin point at the SAME project.
  NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  ```

- [ ] **Step 3: Verify `.gitignore` protects `.env.local`**

  Run from the `mei` directory:

  ```bash
  git check-ignore -v .env.local
  ```

  Expected output: `.gitignore:1:.env* .env.local` (or any line showing it is ignored).

  If `.env.local` is NOT ignored, open `mei/.gitignore` and add:

  ```
  .env.local
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add mei/.env.example
  # Do NOT git add mei/.env.local — it contains secrets
  git commit -m "chore: add storefront env example for Supabase wiring"
  ```

---

### Task 2: Add public-read RLS policy for storefront anon access

**Files:**
- Create: `mei-admin/supabase/migrations/20260615_storefront_public_read.sql`

> **Context:** The current RLS policies on `products` and `categories` only allow rows through for authenticated admin users (via `is_admin()`). Requests made with the storefront's anon key hit a dead end — Supabase returns an empty array, not an error. This migration adds SELECT-only policies that let unauthenticated (`anon`) callers read published products and active categories.

- [ ] **Step 1: Write the migration file**

  Create `mei-admin/supabase/migrations/20260615_storefront_public_read.sql`:

  ```sql
  -- Allow anonymous (storefront) reads on published products and active categories.
  -- Existing admin policies are additive (OR); this does not weaken admin access.

  CREATE POLICY "Public reads published products"
    ON public.products FOR SELECT
    USING (status = 'PUBLISHED' AND deleted_at IS NULL);

  CREATE POLICY "Public reads active categories"
    ON public.categories FOR SELECT
    USING (deleted_at IS NULL);
  ```

- [ ] **Step 2: Apply the migration to the remote Supabase project**

  **Option A — Supabase CLI (preferred if CLI is linked):**

  Run from `mei-admin/`:

  ```bash
  supabase link --project-ref hjhqemsyufsifmgespur
  supabase db push
  ```

  Expected output ends with: `Applying migration 20260615_storefront_public_read.sql... done`

  **Option B — Supabase Dashboard (fallback):**

  1. Open https://supabase.com/dashboard/project/hjhqemsyufsifmgespur/sql/new
  2. Paste the SQL from Step 1 and click **Run**.
  3. Expected: `Success. No rows returned`

- [ ] **Step 3: Verify policies in the Dashboard**

  Open https://supabase.com/dashboard/project/hjhqemsyufsifmgespur/auth/policies

  Confirm both of these appear under their tables:
  - `products` → **Public reads published products**
  - `categories` → **Public reads active categories**

- [ ] **Step 4: Commit the migration file**

  ```bash
  git add mei-admin/supabase/migrations/20260615_storefront_public_read.sql
  git commit -m "feat: add public read RLS policies for storefront anon access"
  ```

---

### Task 3: Create connectivity smoke-test API route

**Files:**
- Create: `mei/src/app/api/db-ping/route.ts`

> **Context:** Next.js 16 App Router route handlers live in `app/api/*/route.ts` and export named HTTP-method functions. We use the existing `src/lib/supabase/server.ts` client (which reads env vars). The route fetches one row from `products` to prove end-to-end connectivity. A non-empty `data` array means the env vars, network, and RLS are all working.

- [ ] **Step 1: Write the route**

  Create `mei/src/app/api/db-ping/route.ts`:

  ```ts
  import { NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export async function GET() {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("id, name, status")
      .eq("status", "PUBLISHED")
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: data.length, sample: data[0] ?? null });
  }
  ```

- [ ] **Step 2: Start the dev server**

  From `mei/`:

  ```bash
  npm run dev
  ```

  Wait for: `✓ Ready on http://localhost:3000`

- [ ] **Step 3: Hit the endpoint and verify**

  In a new terminal:

  ```bash
  curl http://localhost:3000/api/db-ping
  ```

  **Success response** (connectivity working, at least one published product exists):

  ```json
  { "ok": true, "count": 1, "sample": { "id": "...", "name": "...", "status": "PUBLISHED" } }
  ```

  **Acceptable response** (connectivity working, no published products seeded yet):

  ```json
  { "ok": true, "count": 0, "sample": null }
  ```

  **Failure responses to investigate:**
  - `{ "ok": false, "error": "..." }` → Check env vars are loaded (restart dev server after adding `.env.local`).
  - `fetch failed` / `ENOTFOUND` → The Supabase URL in `.env.local` is wrong.
  - `{ "ok": true, "count": 0 }` when you expect products → RLS policy from Task 2 was not applied; re-run the migration.

- [ ] **Step 4: Commit**

  ```bash
  git add mei/src/app/api/db-ping/route.ts
  git commit -m "feat: add db-ping route to prove Supabase connectivity"
  ```

---

## Self-Review

**Spec coverage:**
- [x] `mei/.env.local` with matching URL and anon key → Task 1 Step 1
- [x] `mei/.env.example` for reference (no secrets) → Task 1 Step 2
- [x] Trivial server-side query proves connectivity → Task 3
- [x] Same Supabase project as admin → both point at `hjhqemsyufsifmgespur.supabase.co`

**Gap caught:** RLS policies in `005_rls_policies.sql` grant SELECT only to `is_admin()`, meaning the anon key would silently return empty results. Task 2 addresses this explicitly. Without it, the spec's "query succeeds" criterion could pass (no error) while silently lying (empty data). The plan makes this visible.

**Placeholder scan:** No TBDs, no "similar to Task N" references, no steps without code.

**Type consistency:** `createClient()` in the route matches the signature in `src/lib/supabase/server.ts` (returns `Promise<SupabaseClient>`; awaited at call site). `.from("products")` matches the table name in `002_categories_products.sql`.
