# Type Alignment: Storefront ↔ Admin DB Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace storefront's ad-hoc types with DB-derived types so every component field maps 1:1 to the actual Supabase schema, eliminating any remapping layer when read-services are wired in.

**Architecture:** Copy `mei-admin/types/database.ts` into the storefront as `src/lib/supabase/database.ts` (single source of truth). Derive all storefront-facing types from it in `src/types/index.ts`. Update every usage site (mock data, cart store, components) to the new field names in the same task sequence.

**Tech Stack:** TypeScript, Supabase Postgres (remote), Next.js 16 App Router

---

## Decisions

| Mismatch | Decision |
|---|---|
| `images: string[]` vs `image_url: string` | Keep `images: string[]` in storefront type; populated from `product_media` at query time. `image_url` on products stays as a primary-image fallback. |
| `craftType: string` vs `work_types: string[]` | Rename to `work_types: string[]` (exact DB match). Components display `work_types[0]` or join. |
| `inStock: boolean` | **Drop.** No stock field in DB. MEI is enquiry-based; variants have `stock_quantity` but storefront never gatekeeps on it. |
| `categoryName: string` | Replace with `category: { id, name, slug } \| null` (join at query time). |
| Order status lowercase | Change to UPPERCASE to match DB enum. Add `PROCESSING`. |
| Enquiry `occasion` / `budget` | **Add** columns to `enquiries` table. Keep these UX fields — they're valuable context for the admin. |
| `shortDescription` | Rename to `short_description` (snake_case, DB match). |
| Category `image` | Rename to `image_url` (DB match). |

---

## File Map

| Action | Path |
|---|---|
| Create | `mei-admin/supabase/migrations/20260615_enquiries_add_occasion_budget.sql` |
| Modify | `mei-admin/types/database.ts` |
| Create | `mei/src/lib/supabase/database.ts` |
| Rewrite | `mei/src/types/index.ts` |
| Modify | `mei/src/lib/data/mockProducts.ts` |
| Modify | `mei/src/store/cart.ts` |
| Modify | `mei/src/components/shop/ProductCard.tsx` |
| Modify | `mei/src/app/shop/page.tsx` |
| Modify | `mei/src/app/shop/[slug]/page.tsx` |

---

### Task 1: Add occasion + budget columns to enquiries

**Files:**
- Create: `mei-admin/supabase/migrations/20260615_enquiries_add_occasion_budget.sql`

> **Context:** The admin `enquiries` table has `name, email, phone, message, status` — no occasion or budget. The storefront contact form captures these and they're valuable for the admin to see. This migration adds two nullable TEXT columns. The existing NOT NULL constraint on `message` stays. Supabase project ref: `hjhqemsyufsifmgespur`.

- [ ] **Step 1: Create the migration file**

  Create `mei-admin/supabase/migrations/20260615_enquiries_add_occasion_budget.sql`:

  ```sql
  -- Add occasion and budget fields captured by storefront contact form.
  -- Both nullable so existing enquiries remain valid.
  ALTER TABLE public.enquiries
    ADD COLUMN IF NOT EXISTS occasion TEXT,
    ADD COLUMN IF NOT EXISTS budget   TEXT;
  ```

- [ ] **Step 2: Apply to remote Supabase**

  **Option A — CLI:**
  ```bash
  cd mei-admin
  supabase db push
  ```
  Expected: `Applying migration 20260615_enquiries_add_occasion_budget.sql... done`

  **Option B — Dashboard:**
  1. Open https://supabase.com/dashboard/project/hjhqemsyufsifmgespur/sql/new
  2. Paste the SQL from Step 1 and click **Run**.
  3. Expected: `Success. No rows returned`

- [ ] **Step 3: Verify columns exist**

  In Supabase Dashboard → Table Editor → `enquiries`, confirm `occasion` and `budget` columns appear.

- [ ] **Step 4: Commit the migration**

  ```bash
  git add mei-admin/supabase/migrations/20260615_enquiries_add_occasion_budget.sql
  git commit -m "feat: add occasion and budget columns to enquiries"
  ```

---

### Task 2: Update admin database.ts with new columns and product_media

**Files:**
- Modify: `mei-admin/types/database.ts`

> **Context:** The current `database.ts` is the generated type file. It's missing two things: (1) the new `occasion` / `budget` columns on `enquiries`, and (2) the `product_media` table (added in migration `20260612014_create_product_media.sql`). We update it manually here; a future `supabase gen types` will keep it current.

- [ ] **Step 1: Open `mei-admin/types/database.ts` and apply the diff**

  **Change 1 — add `occasion` and `budget` to enquiries Row and Insert:**

  Find the `enquiries` block (currently at line 42–45) and replace it with:

  ```typescript
        enquiries: {
          Row: { id: string; name: string; email: string; phone: string | null; occasion: string | null; budget: string | null; message: string; status: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply: string | null; replied_at: string | null; replied_by: string | null; created_at: string }
          Insert: { id?: string; name: string; email: string; phone?: string | null; occasion?: string | null; budget?: string | null; message: string; status?: 'NEW' | 'REPLIED' | 'CLOSED' }
          Update: { status?: 'NEW' | 'REPLIED' | 'CLOSED'; admin_reply?: string | null; replied_at?: string | null; replied_by?: string | null }
        }
  ```

  **Change 2 — add `product_media` table after `order_items`:**

  After the closing brace of `order_items` and before `enquiries`, insert:

  ```typescript
        product_media: {
          Row: { id: string; product_id: string; color_id: string | null; variant_id: string | null; url: string; alt_text: string | null; is_primary: boolean; media_type: 'IMAGE' | 'VIDEO'; thumbnail_url: string | null; video_provider: string | null; sort_order: number; created_by: string | null; created_at: string; deleted_at: string | null }
          Insert: { id?: string; product_id: string; color_id?: string | null; variant_id?: string | null; url: string; alt_text?: string | null; is_primary?: boolean; media_type?: 'IMAGE' | 'VIDEO'; thumbnail_url?: string | null; video_provider?: string | null; sort_order?: number; created_by?: string | null }
          Update: { url?: string; alt_text?: string | null; is_primary?: boolean; media_type?: 'IMAGE' | 'VIDEO'; thumbnail_url?: string | null; sort_order?: number; deleted_at?: string | null }
        }
  ```

  **Change 3 — add `media_type` enum after `enquiry_status`:**

  In the `Enums` block (currently lines 63–68), add:

  ```typescript
        media_type: 'IMAGE' | 'VIDEO'
  ```

  Full updated `Enums` block:
  ```typescript
      Enums: {
        admin_role: 'admin' | 'super_admin'
        order_status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
        product_status: 'PUBLISHED' | 'DRAFT'
        enquiry_status: 'NEW' | 'REPLIED' | 'CLOSED'
        media_type: 'IMAGE' | 'VIDEO'
      }
  ```

- [ ] **Step 2: Verify TypeScript accepts the changes**

  ```bash
  cd mei-admin
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add mei-admin/types/database.ts
  git commit -m "chore: add product_media and enquiry occasion/budget to database types"
  ```

---

### Task 3: Copy database.ts to storefront and rewrite types/index.ts

**Files:**
- Create: `mei/src/lib/supabase/database.ts`
- Rewrite: `mei/src/types/index.ts`

> **Context:** The storefront needs the same generated types as the admin. We copy `database.ts` verbatim. Then `types/index.ts` is rewritten to derive all storefront types from it — no more hand-authored shapes.

- [ ] **Step 1: Copy database.ts to storefront**

  Copy the full content of `mei-admin/types/database.ts` into `mei/src/lib/supabase/database.ts` (same content, different path).

  File content to write to `mei/src/lib/supabase/database.ts`:

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

- [ ] **Step 2: Rewrite `mei/src/types/index.ts`**

  Replace the entire file with:

  ```typescript
  import type { Database } from "@/lib/supabase/database";

  type Tables = Database["public"]["Tables"];

  // ── Raw DB row types (use for Supabase queries) ──────────────────────────────
  export type DbProduct      = Tables["products"]["Row"];
  export type DbCategory     = Tables["categories"]["Row"];
  export type DbProductMedia = Tables["product_media"]["Row"];
  export type DbOrder        = Tables["orders"]["Row"];
  export type DbOrderItem    = Tables["order_items"]["Row"];
  export type DbEnquiry      = Tables["enquiries"]["Row"];

  // ── Enums ─────────────────────────────────────────────────────────────────────
  export type ProductStatus = Database["public"]["Enums"]["product_status"];
  export type OrderStatus   = Database["public"]["Enums"]["order_status"];
  export type EnquiryStatus = Database["public"]["Enums"]["enquiry_status"];

  // ── Storefront view-model types (what pages and components receive) ───────────

  export type Category = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;   // was: image
    subtitle: string | null;
    is_active: boolean;
    sort_order: number;
  };

  export type Product = {
    id: string;
    name: string;
    slug: string;
    price: number;
    short_description: string | null;   // was: shortDescription
    description: string | null;
    work_types: string[];               // was: craftType: string
    status: ProductStatus;
    category_id: string | null;         // was: categoryId
    category: Pick<Category, "id" | "name" | "slug"> | null;  // was: categoryName
    image_url: string | null;           // primary image fallback from products table
    images: string[];                   // urls from product_media, sorted by sort_order
    // REMOVED: inStock (no DB equivalent — MEI is enquiry-based)
  };

  export type OrderItem = {
    id: string;
    order_id: string;
    product_id: string | null;
    product_name: string;   // was: name
    quantity: number;
    unit_price: number;     // was: price
  };

  export type Order = {
    id: string;
    order_number: string;
    customer_id: string | null;
    status: OrderStatus;    // was: lowercase union — now UPPERCASE to match DB
    total: number;
    notes: string | null;
    created_at: string;     // was: createdAt
    items?: OrderItem[];    // joined at read time
  };

  // Insert type for the contact form (what gets written to Supabase)
  export type EnquiryInsert = Tables["enquiries"]["Insert"];

  // CartItem is a UI-only ephemeral type (not a DB table)
  export type CartItem = {
    id: string;
    name: string;
    price: number;
    image: string;
    work_types: string[];   // was: craftType: string
    quantity: number;
  };
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add mei/src/lib/supabase/database.ts mei/src/types/index.ts
  git commit -m "feat: derive storefront types from shared database.ts schema"
  ```

---

### Task 4: Update mockProducts.ts to match new types

**Files:**
- Modify: `mei/src/lib/data/mockProducts.ts`

> **Context:** `MOCK_PRODUCTS` and `MOCK_CATEGORIES` are typed against the old `Product` and `Category` shapes. They'll fail TypeScript after Task 3. This task updates the mock data to the new field names. The read-services story will replace these arrays with Supabase queries — for now, the mocks stay but must typecheck.

- [ ] **Step 1: Rewrite `mei/src/lib/data/mockProducts.ts`**

  Replace the entire file with:

  ```typescript
  import { Product, Category } from "@/types";

  export const MOCK_CATEGORIES: Category[] = [
    {
      id: "lehengas",
      name: "Lehengas",
      slug: "lehengas",
      description: "Handcrafted bridal and couture lehengas made with exquisite materials.",
      image_url: "/images/rose_lehenga.png",
      subtitle: "Bridal Classics",
      is_active: true,
      sort_order: 1,
    },
    {
      id: "sarees",
      name: "Sarees",
      slug: "sarees",
      description: "Classic handloom and embroidered sarees for timeless celebrations.",
      image_url: "/images/velvet_lehenga.png",
      subtitle: "Heritage Drapes",
      is_active: true,
      sort_order: 2,
    },
    {
      id: "anarkalis",
      name: "Anarkalis",
      slug: "anarkalis",
      description: "Regal silhouettes with delicate hand-embroidery and flowing fabrics.",
      image_url: "/images/ivory_lehenga.png",
      subtitle: "Royal Silhouettes",
      is_active: true,
      sort_order: 3,
    },
  ];

  export const MOCK_PRODUCTS: Product[] = [
    {
      id: "prod_rose_lehenga",
      name: "The Rose Lehenga",
      slug: "the-rose-lehenga",
      price: 245000,
      images: ["/images/rose_lehenga.png", "/images/hero_lehenga.png", "/images/velvet_lehenga.png"],
      image_url: "/images/rose_lehenga.png",
      short_description: "A masterpiece in rose-red silk with detailed gold Zardosi embroidery.",
      description: "Handcrafted over 320 hours by our master artisans, The Rose Lehenga features intricate Aari embroidery and gold Zardosi borders on premium silk. The ensemble includes a heavily embellished blouse and a sheer organza dupatta with scalloped borders. Perfect for the traditional bride seeking timeless elegance.",
      work_types: ["Zardosi", "Aari"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_royal_velvet",
      name: "The Royal Velvet Lehenga",
      slug: "the-royal-velvet-lehenga",
      price: 285000,
      images: ["/images/velvet_lehenga.png", "/images/rose_lehenga.png"],
      image_url: "/images/velvet_lehenga.png",
      short_description: "Deep maroon velvet lehenga featuring majestic Mughal-inspired gold and silver embroidery.",
      description: "The Royal Velvet Lehenga represents the pinnacle of royal heritage wear. Tailored in plush deep maroon velvet, it displays intricate motifs inspired by Mughal architecture, stitched in premium metallic threads. Accompanied by a heavy raw-silk blouse and a tissue dupatta.",
      work_types: ["Dabka", "Zardosi"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_ivory_mirror",
      name: "The Ivory Mirror Lehenga",
      slug: "the-ivory-mirror-lehenga",
      price: 195000,
      images: ["/images/ivory_lehenga.png", "/images/hero_lehenga.png"],
      image_url: "/images/ivory_lehenga.png",
      short_description: "Delicate ivory georgette lehenga adorned with hand-woven mirror work and silver thread embroidery.",
      description: "Designed for modern daytime ceremonies or grand sangeet functions, this ivory georgette lehenga sparkles with hundreds of hand-placed mirror embellishments and delicate resham work. Includes a matching sleeveless blouse and a lightweight net dupatta.",
      work_types: ["Mirror Work", "Resham"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_gilded_heritage",
      name: "The Gilded Heritage Lehenga",
      slug: "the-gilded-heritage-lehenga",
      price: 320000,
      images: ["/images/hero_lehenga.png", "/images/rose_lehenga.png"],
      image_url: "/images/hero_lehenga.png",
      short_description: "Luxurious crimson silk lehenga with antique gold embroidery and custom border work.",
      description: "An heirloom-grade bridal lehenga featuring traditional kalis crafted in raw silk. The skirt is detailed with custom borders showcasing floral vines and peacock motifs. Embellished with fine pearls, dabka work, and sequence highlights.",
      work_types: ["Pita", "Dabka"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_rose_lehenga1",
      name: "The Rose Lehenga",
      slug: "the-rose-lehenga-v2",
      price: 245000,
      images: ["/images/rose_lehenga.png", "/images/hero_lehenga.png", "/images/velvet_lehenga.png"],
      image_url: "/images/rose_lehenga.png",
      short_description: "A masterpiece in rose-red silk with detailed gold Zardosi embroidery.",
      description: "Handcrafted over 320 hours by our master artisans, The Rose Lehenga features intricate Aari embroidery and gold Zardosi borders on premium silk. The ensemble includes a heavily embellished blouse and a sheer organza dupatta with scalloped borders. Perfect for the traditional bride seeking timeless elegance.",
      work_types: ["Zardosi", "Aari"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_royal_velvet1",
      name: "The Royal Velvet Lehenga",
      slug: "the-royal-velvet-lehenga-v2",
      price: 285000,
      images: ["/images/velvet_lehenga.png", "/images/rose_lehenga.png"],
      image_url: "/images/velvet_lehenga.png",
      short_description: "Deep maroon velvet lehenga featuring majestic Mughal-inspired gold and silver embroidery.",
      description: "The Royal Velvet Lehenga represents the pinnacle of royal heritage wear.",
      work_types: ["Dabka", "Zardosi"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_ivory_mirror1",
      name: "The Ivory Mirror Lehenga",
      slug: "the-ivory-mirror-lehenga-v2",
      price: 195000,
      images: ["/images/ivory_lehenga.png", "/images/hero_lehenga.png"],
      image_url: "/images/ivory_lehenga.png",
      short_description: "Delicate ivory georgette lehenga adorned with hand-woven mirror work and silver thread embroidery.",
      description: "Designed for modern daytime ceremonies or grand sangeet functions, this ivory georgette lehenga sparkles with hundreds of hand-placed mirror embellishments and delicate resham work.",
      work_types: ["Mirror Work", "Resham"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
    {
      id: "prod_gilded_heritage1",
      name: "The Gilded Heritage Lehenga",
      slug: "the-gilded-heritage-lehenga-v2",
      price: 320000,
      images: ["/images/hero_lehenga.png", "/images/rose_lehenga.png"],
      image_url: "/images/hero_lehenga.png",
      short_description: "Luxurious crimson silk lehenga with antique gold embroidery and custom border work.",
      description: "An heirloom-grade bridal lehenga featuring traditional kalis crafted in raw silk.",
      work_types: ["Pita", "Dabka"],
      status: "PUBLISHED",
      category_id: "lehengas",
      category: { id: "lehengas", name: "Lehengas", slug: "lehengas" },
    },
  ];
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add mei/src/lib/data/mockProducts.ts
  git commit -m "chore: align mock data shapes with new DB-derived types"
  ```

---

### Task 5: Update cart store (craftType → work_types)

**Files:**
- Modify: `mei/src/store/cart.ts`

> **Context:** `CartItem` now lives in `src/types/index.ts` (Task 3). The store should import it from there rather than redefining it. The only field change is `craftType: string` → `work_types: string[]`.
> **Note:** Existing carts persisted in localStorage under key `"mei-cart"` will have a stale `craftType` field that no longer matches the type. This is fine — Zustand's persist middleware merges state; old items may briefly show empty `work_types` until the cart is cleared. No migration needed for a dev environment.

- [ ] **Step 1: Rewrite `mei/src/store/cart.ts`**

  ```typescript
  import { create } from "zustand";
  import { persist } from "zustand/middleware";
  import type { CartItem } from "@/types";

  type CartStore = {
    items: CartItem[];
    addItem: (item: Omit<CartItem, "quantity">) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    total: () => number;
    itemCount: () => number;
  };

  export const useCartStore = create<CartStore>()(
    persist(
      (set, get) => ({
        items: [],

        addItem: (item) => {
          set((state) => {
            const existing = state.items.find((i) => i.id === item.id);
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                ),
              };
            }
            return { items: [...state.items, { ...item, quantity: 1 }] };
          });
        },

        removeItem: (id) =>
          set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

        updateQuantity: (id, quantity) => {
          if (quantity < 1) {
            get().removeItem(id);
            return;
          }
          set((state) => ({
            items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
          }));
        },

        clearCart: () => set({ items: [] }),

        total: () =>
          get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

        itemCount: () =>
          get().items.reduce((sum, i) => sum + i.quantity, 0),
      }),
      { name: "mei-cart" }
    )
  );

  export type { CartItem };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add mei/src/store/cart.ts
  git commit -m "chore: import CartItem from shared types, rename craftType to work_types"
  ```

---

### Task 6: Update ProductCard and shop page filter

**Files:**
- Modify: `mei/src/components/shop/ProductCard.tsx`
- Modify: `mei/src/app/shop/page.tsx`

> **Context:** `ProductCard` uses `product.craftType` for the badge. The shop page filters against `product.craftType` and uses `product.id`. Both must switch to `product.work_types`.

- [ ] **Step 1: Update ProductCard badge**

  In `mei/src/components/shop/ProductCard.tsx`, find line 54:
  ```tsx
        {product.craftType}
  ```
  Replace with:
  ```tsx
        {product.work_types[0] ?? ""}
  ```

- [ ] **Step 2: Update shop page filter logic**

  In `mei/src/app/shop/page.tsx`, replace the entire `filteredProducts` useMemo with:

  ```tsx
    const filteredProducts = useMemo(() => {
      if (activeFilter === "ALL") return [...MOCK_PRODUCTS];

      return MOCK_PRODUCTS.filter((product) => {
        const types = product.work_types.map((t) => t.toLowerCase());

        if (activeFilter === "AARI WORK")
          return types.some((t) => t.includes("aari"));
        if (activeFilter === "ZARDOSI")
          return types.some((t) => t.includes("zardosi") || t.includes("dabka"));
        if (activeFilter === "MIRROR WORK")
          return types.some((t) => t.includes("mirror"));
        if (activeFilter === "THREAD EMBROIDERY")
          return types.some((t) => t.includes("resham") || t.includes("thread") || t.includes("pita"));
        if (activeFilter === "CUT WORK")
          return types.some((t) => t.includes("cut"));

        return true;
      });
    }, [activeFilter]);
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add mei/src/components/shop/ProductCard.tsx mei/src/app/shop/page.tsx
  git commit -m "fix: use work_types[] for product craft badge and shop filters"
  ```

---

### Task 7: Update product detail page

**Files:**
- Modify: `mei/src/app/shop/[slug]/page.tsx`

> **Context:** The product detail page uses: `product.craftType` (two places), `product.categoryName`, `product.shortDescription` (implicitly via description), `product.id` (cart add). Also, the cart `addItem` call passes `craftType` — update to `work_types`.

- [ ] **Step 1: Update the page imports and field accesses**

  In `mei/src/app/shop/[slug]/page.tsx`, make these changes:

  **Change 1** — update `handleAddToCart` to use `work_types`:

  Find:
  ```tsx
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        craftType: product.craftType,
      });
  ```
  Replace with:
  ```tsx
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        work_types: product.work_types,
      });
  ```

  **Change 2** — update craft tag display (line ~99):

  Find:
  ```tsx
                <span className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
                  {product.craftType}
                </span>
  ```
  Replace with:
  ```tsx
                {product.work_types.map((type) => (
                  <span key={type} className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
                    {type}
                  </span>
                ))}
  ```

  **Change 3** — update breadcrumb `categoryName` (line ~59):

  Find:
  ```tsx
          <Link href="/shop" className="hover:text-[#c9a465] transition-colors">
            {product.categoryName}
          </Link>
  ```
  Replace with:
  ```tsx
          <Link href="/shop" className="hover:text-[#c9a465] transition-colors">
            {product.category?.name ?? "Shop"}
          </Link>
  ```

  **Change 4** — update category label (line ~80):

  Find:
  ```tsx
              <span className="text-xs uppercase tracking-widest text-[#9a9a9a] font-medium block">
                {product.categoryName}
              </span>
  ```
  Replace with:
  ```tsx
              <span className="text-xs uppercase tracking-widest text-[#9a9a9a] font-medium block">
                {product.category?.name ?? ""}
              </span>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add mei/src/app/shop/[slug]/page.tsx
  git commit -m "fix: use work_types[], category.name on product detail page"
  ```

---

### Task 8: Verify TypeScript compiles clean

**Files:** (read-only verification)

> **Context:** After all changes, there must be zero TypeScript errors. This catches any missed `craftType`, `categoryName`, `inStock`, or `shortDescription` references.

- [ ] **Step 1: Run type check in mei**

  ```bash
  cd mei
  npx tsc --noEmit
  ```

  Expected: no output (zero errors).

  **If you see errors**, fix them before proceeding. Common ones:
  - `Property 'craftType' does not exist` → find remaining usage and update to `work_types[0]`
  - `Property 'categoryName' does not exist` → update to `category?.name`
  - `Property 'inStock' does not exist` → remove the reference
  - `Property 'shortDescription' does not exist` → rename to `short_description`
  - `Property 'image' does not exist on Category` → rename to `image_url`

- [ ] **Step 2: Run type check in mei-admin**

  ```bash
  cd mei-admin
  npx tsc --noEmit
  ```

  Expected: no output (zero errors).

- [ ] **Step 3: Commit the verification (no code change needed)**

  If zero errors in both repos, open `docs/superpowers/plans/2026-06-15-type-alignment.md` and mark the self-review section complete. No additional commit needed — the verification is its own evidence.

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `images[]` vs `image_url` — decision recorded | Decision table at top + Task 3 (Product type) |
| `craftType` → `work_types[]` | Tasks 3, 4, 5, 6, 7 |
| `inStock` dropped | Task 3 (removed from Product type), Task 4 (removed from mock data) |
| `categoryName` → join | Tasks 3, 4, 7 |
| Admin extras (status, deleted_at) | Task 3 (status on Product type) |
| Order status UPPERCASE | Task 3 (OrderStatus type) |
| Enquiry occasion/budget — add to DB | Task 1 (migration) |
| Documented mapping | Decision table + Task 3 comments |
| Shared database types | Tasks 2, 3 (database.ts) |
| Decisions recorded | Decision table at top of plan |

**Placeholder scan:** All steps have exact code. No TBDs.

**Type consistency:**
- `Product.work_types: string[]` defined in Task 3, consumed in Tasks 4 (mock data), 5 (CartItem), 6 (ProductCard + shop filter), 7 (detail page)
- `CartItem.work_types: string[]` defined in Task 3 (types/index.ts), used in Task 5 (cart store), Task 7 (addItem call)
- `Category.image_url` defined in Task 3, updated in mock data Task 4
- `Product.category` shape `{ id, name, slug }` defined in Task 3, populated in Task 4, consumed in Task 7
- `EnquiryInsert` includes `occasion` and `budget` after Task 1 migration + Task 2 database.ts update

---

### Task 9: Validate live Supabase schema matches types


**Files:** (read-only verification)

> **Context:** Confirm the manually-updated `database.ts` matches the actual live schema. Required before the ticket can be closed. Supabase CLI must be linked to project `hjhqemsyufsifmgespur`.

- [ ] **Step 1: Generate fresh types from Supabase**

  ```bash
  cd mei-admin
  supabase gen types typescript --project-id hjhqemsyufsifmgespur > generated-types.ts
  ```

- [ ] **Step 2: Diff generated types against database.ts**

  ```bash
  diff generated-types.ts types/database.ts
  ```

  Review any diffs for: `products`, `categories`, `enquiries`, `product_media`, `order_status`, `enquiry_status`, `product_status` enums.

  If the generated file adds fields not in `database.ts`, add them to both `mei-admin/types/database.ts` and `mei/src/lib/supabase/database.ts`, commit both, and re-run `tsc --noEmit`.

- [ ] **Step 3: Clean up**

  ```bash
  rm mei-admin/generated-types.ts
  ```

---

### Task 10: Validate enquiry migration applied

**Files:** (Supabase Dashboard SQL verification)

> **Context:** Confirm the `occasion` and `budget` columns from Task 1 actually exist in the live database.

- [ ] **Step 1: Run SQL in Supabase Dashboard**

  Open https://supabase.com/dashboard/project/hjhqemsyufsifmgespur/sql/new and run:

  ```sql
  INSERT INTO enquiries (name, email, message, occasion, budget)
  VALUES ('MEI Test', 'test@example.com', 'Testing type-alignment plan', 'Wedding', '2-5 Lakhs')
  RETURNING id, occasion, budget;
  ```

  Expected: one row returned with `occasion = 'Wedding'` and `budget = '2-5 Lakhs'`.

- [ ] **Step 2: Clean up test row**

  ```sql
  DELETE FROM enquiries WHERE email = 'test@example.com' AND name = 'MEI Test';
  ```

---

### Task 11: Verify product_media strategy

**Files:** (Supabase Dashboard SQL verification)

> **Context:** Confirm the `product_media` table exists with the expected columns, and check whether any rows exist. This validates the images decision: `image_url` = fallback, `images[]` = product_media rows.

- [ ] **Step 1: Check table structure**

  In Supabase Dashboard → Table Editor, open `product_media` and confirm columns: `product_id`, `url`, `sort_order`, `is_primary`, `media_type`.

- [ ] **Step 2: Check for existing rows**

  ```sql
  SELECT product_id, url, sort_order, is_primary
  FROM product_media
  ORDER BY product_id, sort_order
  LIMIT 10;
  ```

  If rows exist: connectivity to product_media is validated.
  If no rows: note it — the read-services story will populate media at product-create time. No action needed here.

- [ ] **Step 3: Confirm storefront type supports strategy**

  Read `mei/src/types/index.ts` and confirm `Product` has both `image_url: string | null` and `images: string[]`. If both fields are present, the strategy is implemented.

---

### Task 12: Global refactor verification — no legacy fields

**Files:** (grep verification across entire `mei/` project)

> **Context:** Ensure no component or data file still references the old field names after Tasks 3–7.

- [ ] **Step 1: Check for craftType**

  ```bash
  grep -r "craftType" mei/src/
  ```

  Expected: 0 results.

- [ ] **Step 2: Check for categoryName**

  ```bash
  grep -r "categoryName" mei/src/
  ```

  Expected: 0 results.

- [ ] **Step 3: Check for shortDescription (camelCase)**

  ```bash
  grep -r "shortDescription" mei/src/
  ```

  Expected: 0 results.

- [ ] **Step 4: Check for inStock**

  ```bash
  grep -r "inStock" mei/src/
  ```

  Expected: 0 results.

  If any result is found: fix the file, commit, and re-run the grep.

---

### Task 13: Storefront build validation

**Files:** (build verification)

> **Context:** `npm run build` runs Next.js's full TypeScript compile + static generation. This catches errors that `tsc --noEmit` can miss (e.g., dynamic import issues, missing pages).

- [ ] **Step 1: Run production build**

  ```bash
  cd mei
  npm run build
  ```

  Expected output contains:
  ```
  ✓ Compiled successfully
  ```

  If build fails with TypeScript errors, fix them and re-run.

- [ ] **Step 2: Commit any fixes discovered during build**

  If you had to fix files to make the build pass:
  ```bash
  git add <fixed-files>
  git commit -m "fix: resolve build errors from type alignment"
  ```

---

### Task 14: Runtime UI verification

**Files:** (manual browser verification)

> **Context:** TypeScript passing doesn't guarantee the UI renders correctly. Start the dev server and visually verify the key flows that touch the renamed fields.

- [ ] **Step 1: Start dev server**

  ```bash
  cd mei
  npm run dev
  ```

  Wait for: `✓ Ready on http://localhost:3000`

- [ ] **Step 2: Verify homepage**

  Open http://localhost:3000. Expected: page loads, no console errors, featured product cards render with images.

- [ ] **Step 3: Verify shop page**

  Open http://localhost:3000/shop. Expected: product cards render, craft badges show (from `work_types[0]`), filters work.

- [ ] **Step 4: Verify product detail page**

  Click any product card. Expected: breadcrumb shows category name, work type badges display, Add to Cart works, cart opens.

- [ ] **Step 5: Check browser console**

  Open DevTools → Console. Expected: no red errors.

---

### Task 15: TypeScript verification (final)

**Files:** (final type-check pass)

- [ ] **Step 1: Type-check storefront**

  ```bash
  cd mei
  npx tsc --noEmit
  ```

  Expected: 0 errors, 0 output.

- [ ] **Step 2: Type-check admin**

  ```bash
  cd mei-admin
  npx tsc --noEmit
  ```

  Expected: 0 errors, 0 output.

---

### Task 16: Final acceptance criteria sign-off

**Files:** (checklist verification)

- [ ] **AC1:** Storefront product/category/order/enquiry types reconciled with admin schema
  - Evidence: shared `database.ts` exists at `mei/src/lib/supabase/database.ts`
  - Evidence: `mei/src/types/index.ts` derives all types from it
  - Evidence: `tsc --noEmit` passes in both repos

- [ ] **AC2:** Documented mapping/shared source of truth exists
  - Evidence: Decision table at top of this plan file
  - Evidence: `database.ts` is the single authoritative type source

- [ ] **AC3:** Decisions recorded for images, stock, and enquiry occasion/budget
  - Evidence: Decision table (top of plan) — images, inStock, occasion/budget all covered
  - Evidence: product_media validation (Task 11) confirmed table structure
  - Evidence: enquiry migration validated (Task 10)

- [ ] **Definition of Done:**
  - All 16 tasks completed
  - TypeScript passes in both repos (Task 15)
  - `npm run build` passes (Task 13)
  - UI smoke tests pass (Task 14)
  - Supabase schema validated (Tasks 9, 10, 11)
  - No legacy field references remain (Task 12)
  - All AC verified (this task)
