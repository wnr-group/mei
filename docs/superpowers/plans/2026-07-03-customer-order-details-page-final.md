# Customer Order Details Page — Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a server-rendered `/orders/[id]` page displaying order details (items, address, phone, payment reference, status) and add a "View Order Details" link to the checkout success screen, so customers can revisit their order after checkout.

**Architecture:** Server Component fetches order data via the Supabase service-role client (bypasses RLS, never reaches browser). UUID in URL provides enumeration resistance without authentication. `getOrderById` lives in a new `orders-server.ts` file — isolated from `orders.ts` which is imported by the client-component checkout page — preventing service-role key exposure via client bundles. The checkout page gets one new state variable and one new link on the success screen; all other checkout logic is untouched.

**Tech Stack:** Next.js 16 App Router (async Server Component, `params: Promise<{id: string}>` API), Supabase JS v2 with service role client, Vitest 4 (node environment), Tailwind CSS 4, TypeScript 5.

---

## Phase 0 — Complete Discovery Evidence

### Finding 1: Route does NOT exist (spec claim validated)
- `Glob("src/app/**/*")` → no `orders/` directory
- `grep -r "/orders" src/` → zero matches in application code
- Business context: the spec says "checkout eventually leads users to an order details URL resulting in a 404" — confirmed by the fact that the checkout success screen shows the order_number reference, prompting users/Dinesh to manually navigate to `/orders/[something]` which 404s.

### Finding 2: No redirect in checkout — success is inline state (exact lines)
| Line | File | Code |
|------|------|------|
| 51 | `src/app/checkout/page.tsx` | `const [orderId, setOrderId] = useState<string | null>(null);` |
| 195 | `src/app/checkout/page.tsx` | `setOrderId(result.orderNumber);` (bypass mode) |
| 258 | `src/app/checkout/page.tsx` | `setOrderId(result.orderNumber);` (production handler) |
| 295 | `src/app/checkout/page.tsx` | `if (orderId) { return <success screen> }` |

`result.orderId` (UUID) is returned from `createOrder()` at both call sites but currently discarded. `result.orderNumber` (e.g., "#ORD-9042") is what's stored in `orderId` state and displayed as "Order Reference" in the success UI.

### Finding 3: Database — confirmed columns (sources: migration files only)

**`orders` table** — migrations `003_customers_orders.sql`, `20260629_checkout_production.sql`, `20260616153000_orders_enquiries_soft_delete.sql`:
| Column | Type | Source | Notes |
|--------|------|--------|-------|
| `id` | UUID PK | 003 | Primary key for URL |
| `order_number` | TEXT UNIQUE | 003 | Auto-generated `#ORD-{seq}` |
| `customer_id` | UUID FK | 003 | → customers.id |
| `status` | enum | 003 | `PENDING` on creation (by edge function) |
| `total` | NUMERIC(12,2) | 003 | Verified server-side by edge function |
| `notes` | TEXT | 003 | NOT used by storefront checkout |
| `payment_id` | TEXT UNIQUE | 20260629 | Razorpay payment ID (`pay_XXX`) |
| `payment_provider` | TEXT | 20260629 | `"razorpay"` |
| `payment_metadata` | JSONB | 20260629 | `{razorpay_order_id, razorpay_signature, request_id}` |
| `shipping_address` | JSONB | 20260629 | `{addressLine1, addressLine2, city, state, pincode, country}` |
| `created_at` | TIMESTAMPTZ | 003 | |
| `updated_at` | TIMESTAMPTZ | 003 | |
| `deleted_at` | TIMESTAMPTZ | 20260616153000 | Soft delete — **NOT in storefront's `database.ts` types** |

**Additional columns in live DB (NOT in tracked storefront migrations, confirmed from admin webhook/types):**
`razorpay_order_id`, `razorpay_payment_id`, `payment_method`, `payment_status`, `payment_captured_at`, `webhook_verified`, `reconciliation_status`. These are used by the admin payment flow (`lib/services/payment-orders.ts`) and Razorpay webhook (`app/api/payments/webhook/route.ts`). **They are NOT populated by the storefront edge function** — storefront checkout stores `payment_id` (=Razorpay payment ID) not `razorpay_payment_id`. We do NOT reference these columns to stay within the storefront's confirmed schema.

**`customers` table** — `003_customers_orders.sql`:
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT | trimmed |
| `email` | TEXT UNIQUE | lowercased by `create_order_txn` |
| `phone` | TEXT | nullable (`nullif(trim(...), '')`) |
| `city` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | |

**`order_items` table** — `003_customers_orders.sql` + `20260612017_alter_order_items.sql`:
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `order_id` | UUID FK | |
| `product_id` | UUID nullable FK | |
| `product_name` | TEXT | **SNAPSHOT** — from `item->>'name'` in edge function |
| `quantity` | INTEGER | |
| `unit_price` | NUMERIC(12,2) | **SNAPSHOT** — from actual DB product price |
| `created_at` | TIMESTAMPTZ | |
| `variant_id` | UUID nullable | always NULL for storefront checkout |
| `product_snapshot` | JSONB nullable | always NULL for storefront checkout (not populated by `create_order_txn`) |
| `variant_snapshot` | JSONB nullable | always NULL for storefront checkout |

**No image snapshot exists for storefront-created orders** — `product_snapshot` is NULL. Cannot use `products.image_url` (mutable catalog value, prohibited). Order items will be displayed without images.

### Finding 4: `payment_metadata` JSON structure (confirmed from edge function)
`mei-admin/supabase/functions/create-order/index.ts` stores:
```json
{
  "razorpay_order_id": "order_XXX",
  "razorpay_signature": "HMAC_sig",
  "request_id": "uuid"
}
```
**`razorpay_signature` MUST NOT be displayed** — it is a security token. We display `razorpay_order_id` as the Razorpay order reference.

### Finding 5: RLS policies (confirmed from `005_rls_policies.sql`)
```sql
-- orders: SELECT only for is_admin()
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT USING (public.is_admin());
-- customers: SELECT only for is_admin()
CREATE POLICY "Admins manage customers" ON public.customers FOR ALL USING (public.is_admin());
-- order_items: SELECT only for is_admin()
CREATE POLICY "Admins manage order_items" ON public.order_items FOR ALL USING (public.is_admin());
```
**Storefront anon client (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) CANNOT read orders, customers, or order_items.** We must use `createServiceClient()` (service role key). This is server-side only.

### Finding 6: No anon grants for orders
`2026061501_storefront_public_read.sql` grants SELECT only on `products` and `categories`.
`012_grant_anon_products_select.sql` grants SELECT on `products`, `categories`, `product_media`.
**No grant on orders, customers, or order_items.**

### Finding 7: Guest checkout is intentional architecture
- No `supabase.auth.getUser()` calls in any storefront page
- `src/app/checkout/page.tsx` is fully public (`"use client"`, no auth check)
- Guest checkout is the only flow — no Supabase auth session exists for customers

### Finding 8: Order status on creation
- Edge function calls `create_order_txn` which inserts `status = 'PENDING'`
- Admin manually updates to `CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED`
- Razorpay webhook (`admin/app/api/payments/webhook/route.ts`) updates `payment_status` (separate column) but **does NOT update `orders.status`**
- Customers will see `PENDING` initially — this is expected behavior

### Finding 9: Address format
`src/app/checkout/page.tsx:178-186`:
```ts
shipping_address: {
  addressLine1: formData.addressLine1,
  addressLine2: formData.addressLine2,
  city: formData.city,
  state: formData.state,
  pincode: formData.pincode,
  country: formData.country,
}
```
Stored verbatim in `orders.shipping_address` JSONB. Keys are camelCase.

### Finding 10: `deleted_at` TypeScript workaround
`orders.deleted_at` exists in the database (migration `20260616153000`) but is NOT in the storefront's `src/lib/supabase/database.ts` type definition. We SELECT it as a string in the query, cast the result to our own `RawOrderRow` type that includes it, and filter in TypeScript after the query. We do NOT modify `database.ts` (unrelated to this feature).

### Finding 11: Privacy decision (no auth, UUID access control)
- UUID v4 provides 2^122 possible values — brute force enumeration is infeasible
- Access control: if you have the UUID, you can see the order
- Decision: **show full customer name, email, and phone** — customers viewing their own order should see their own data; UUIDs are not guessable so risk of unauthorized access is negligible
- `razorpay_signature` from `payment_metadata`: **NOT displayed** (security token)
- This decision should be revisited when authentication is added to the storefront

### Finding 12: `orders-server.ts` is required (client bundle safety)
`src/lib/services/orders.ts` is imported by `src/app/checkout/page.tsx` which is a `"use client"` component. Adding `createServiceClient()` to `orders.ts` would pull `SUPABASE_SERVICE_ROLE_KEY` into the client bundle. Therefore, server-only order queries live in a new `orders-server.ts` file. This matches the pattern where `server.ts` and `service-client.ts` are separate Supabase helpers that must not be imported by client components.

---

## Phase 1 — Architecture

### Access Model
**Public UUID access.** Route: `/orders/[id]` where `id` = `orders.id` (UUID v4). No authentication required. Security through UUID entropy (128-bit random, 2^122 unique values).

### Privacy Model
Full customer name, email, and phone displayed. `razorpay_signature` never displayed. Payment reference (`payment_id` and `payment_metadata.razorpay_order_id`) displayed — these are already in customer email receipts. Revisit when auth is added.

### Security Model
- Service role key used only in Server Component (server process only, never bundled for client)
- `SUPABASE_SERVICE_ROLE_KEY` is not prefixed with `NEXT_PUBLIC_` — Next.js never includes it in client bundles
- No sensitive fields exposed via React component props or page `JSON.stringify` output
- Soft-deleted orders return "not found" UI (no 404 — custom component)

### Fetch Strategy
Single async Server Component. One Supabase query with two joins (`customers`, `order_items`). No parallel fetches needed. No `useEffect`, no client-side fetch, no SWR/React Query.

### Cache Strategy
**No caching.** Dynamic route — Next.js 16 renders dynamic segments on every request by default (no `generateStaticParams`). Order `status` is mutable (admin updates it), so caching would show stale data.

### Failure Strategy
| Failure | Behavior |
|---------|----------|
| Order UUID not found | Custom "Order Not Found" UI in page (not Next.js 404) |
| Order soft-deleted (`deleted_at` not null) | Custom "Order Not Found" UI |
| DB error / service role key missing | `error.tsx` boundary catches throw, shows "Unable to Load Order" with retry |
| Supabase unreachable | Same as DB error |

### Future-Compatibility Notes
- `getOrderById(id: string)` can be co-located with a future `getOrdersByCustomer(customerId: string, page: number)` in the same file
- When auth is added, the page adds: `const user = await getUser(); if (!user || order.customer?.email !== user.email) notFound();` — no service refactor needed
- `OrderDetail` type is independent; future shipment tracking adds `tracking_number?: string` to the type without breaking existing usage

---

## Global Constraints (apply to every task)

- Do NOT modify create-order Edge Function
- Do NOT modify notification pipeline (Mailgun, WhatsApp, notification_jobs)
- Do NOT modify Razorpay logic or payment verification
- Do NOT modify existing checkout validation
- Do NOT modify DB schema
- Do NOT refactor unrelated files
- Do NOT introduce new npm dependencies
- Do NOT change design language (colors, fonts, spacing, border styles must match existing pages)
- Do NOT change existing API contracts
- `getOrderById` MUST be in `orders-server.ts`, NOT `orders.ts`
- Product images MUST NOT be shown (no snapshot; mutable catalog prohibited)
- `razorpay_signature` MUST NOT appear on the page
- `deleted_at IS NULL` must be enforced (treat soft-deleted as not found)
- Every task ends with `npm test` green before commit

---

## File Structure

**Create:**
- `src/lib/services/orders-server.ts` — `getOrderById()`, all exported types (`OrderDetail`, `OrderItem`, `OrderCustomer`, `ShippingAddress`). Imports `createServiceClient`. Server-only — must never be imported by `"use client"` components.
- `src/lib/services/__tests__/orders-server.test.ts` — Vitest tests for `getOrderById`.
- `src/app/orders/[id]/page.tsx` — Async Server Component. Awaits `params.id`, calls `getOrderById`, renders order or custom "not found" UI.
- `src/app/orders/[id]/loading.tsx` — Pulse-skeleton matching page card layout.
- `src/app/orders/[id]/error.tsx` — `"use client"` error boundary with `unstable_retry`.

**Modify:**
- `src/app/checkout/page.tsx` — Add `orderUuid` state variable; call `setOrderUuid(result.orderId)` alongside existing `setOrderId(result.orderNumber)` at both success sites; add "View Order Details" link in success screen JSX.

---

### Task 1: Add `getOrderById` service function (TDD)

**Files:**
- Create: `src/lib/services/orders-server.ts`
- Create: `src/lib/services/__tests__/orders-server.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ShippingAddress { addressLine1?: string; addressLine2?: string; city?: string; state?: string; pincode?: string; country?: string }
  export interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number }
  export interface OrderCustomer { name: string; email: string | null; phone: string | null; city: string | null }
  export interface OrderDetail { id: string; order_number: string; status: string; total: number; payment_id: string | null; payment_provider: string | null; payment_metadata: { razorpay_order_id?: string; request_id?: string } | null; shipping_address: ShippingAddress | null; created_at: string; customer: OrderCustomer | null; items: OrderItem[] }
  export async function getOrderById(id: string): Promise<OrderDetail | null>
  // Throws on DB error. Returns null if not found or soft-deleted.
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/services/__tests__/orders-server.test.ts` with this exact content:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrderById } from "../orders-server";
import type { OrderDetail } from "../orders-server";

const mockMaybeSingle = vi.fn();
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
};
const mockFrom = vi.fn().mockReturnValue(mockChain);

vi.mock("@/lib/supabase/service-client", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

const SAMPLE_ROW = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  order_number: "#ORD-9001",
  status: "PENDING",
  total: 120000,
  payment_id: "pay_OOPg4VwMCkXKWT",
  payment_provider: "razorpay",
  payment_metadata: {
    razorpay_order_id: "order_OOPg4test123",
    razorpay_signature: "should_never_appear_on_page",
    request_id: "req-uuid-123",
  },
  shipping_address: {
    addressLine1: "12 Marine Drive",
    addressLine2: "Apt 3B",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  },
  created_at: "2026-07-03T10:00:00Z",
  deleted_at: null,
  customers: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    city: "Mumbai",
  },
  order_items: [
    { id: "item-uuid-1", product_name: "Bridal Lehenga", quantity: 1, unit_price: 120000 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrderById", () => {
  it("returns a mapped OrderDetail on success", async () => {
    mockMaybeSingle.mockResolvedValue({ data: SAMPLE_ROW, error: null });

    const result = await getOrderById("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    const expected: OrderDetail = {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      order_number: "#ORD-9001",
      status: "PENDING",
      total: 120000,
      payment_id: "pay_OOPg4VwMCkXKWT",
      payment_provider: "razorpay",
      payment_metadata: {
        razorpay_order_id: "order_OOPg4test123",
        request_id: "req-uuid-123",
      },
      shipping_address: {
        addressLine1: "12 Marine Drive",
        addressLine2: "Apt 3B",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
      created_at: "2026-07-03T10:00:00Z",
      customer: {
        name: "Priya Sharma",
        email: "priya@example.com",
        phone: "+91 98765 43210",
        city: "Mumbai",
      },
      items: [{ id: "item-uuid-1", product_name: "Bridal Lehenga", quantity: 1, unit_price: 120000 }],
    };
    expect(result).toEqual(expected);
  });

  it("excludes razorpay_signature from payment_metadata", async () => {
    mockMaybeSingle.mockResolvedValue({ data: SAMPLE_ROW, error: null });

    const result = await getOrderById("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result?.payment_metadata).not.toHaveProperty("razorpay_signature");
  });

  it("returns null when order is not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getOrderById("nonexistent-uuid");

    expect(result).toBeNull();
  });

  it("returns null when order is soft-deleted", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, deleted_at: "2026-07-03T12:00:00Z" },
      error: null,
    });

    const result = await getOrderById("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toBeNull();
  });

  it("throws and logs when Supabase returns a database error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "DB connection refused" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getOrderById("some-uuid")).rejects.toMatchObject({ message: "DB connection refused" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:getOrderById]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("queries the orders table using the provided UUID", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await getOrderById("target-uuid-456");

    expect(mockFrom).toHaveBeenCalledWith("orders");
    expect(mockChain.eq).toHaveBeenCalledWith("id", "target-uuid-456");
  });

  it("returns null customer when customers join is null", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, customers: null, order_items: [] },
      error: null,
    });

    const result = await getOrderById("some-uuid");

    expect(result?.customer).toBeNull();
    expect(result?.items).toEqual([]);
  });

  it("handles null shipping_address", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, shipping_address: null },
      error: null,
    });

    const result = await getOrderById("some-uuid");

    expect(result?.shipping_address).toBeNull();
  });

  it("handles null payment_metadata", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, payment_id: null, payment_provider: null, payment_metadata: null },
      error: null,
    });

    const result = await getOrderById("some-uuid");

    expect(result?.payment_id).toBeNull();
    expect(result?.payment_metadata).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/services/__tests__/orders-server.test.ts
```

Expected: FAIL — "Cannot find module '../orders-server'"

- [ ] **Step 3: Implement `getOrderById`**

Create `src/lib/services/orders-server.ts` with this exact content:

```ts
import { createServiceClient } from "@/lib/supabase/service-client";

export interface ShippingAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_id: string | null;
  payment_provider: string | null;
  payment_metadata: { razorpay_order_id?: string; request_id?: string } | null;
  shipping_address: ShippingAddress | null;
  created_at: string;
  customer: OrderCustomer | null;
  items: OrderItem[];
}

// Raw shape returned by Supabase. Includes deleted_at which exists in the DB
// (migration 20260616153000) but is missing from the storefront's database.ts types.
// Cast via `as unknown as RawOrderRow` after the query.
type RawOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_id: string | null;
  payment_provider: string | null;
  payment_metadata: Record<string, unknown> | null;
  shipping_address: Record<string, string> | null;
  created_at: string;
  deleted_at: string | null;
  customers: { name: string; email: string | null; phone: string | null; city: string | null } | null;
  order_items: Array<{ id: string; product_name: string; quantity: number; unit_price: number }>;
};

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const result = await createServiceClient()
    .from("orders")
    .select(
      "id, order_number, status, total, payment_id, payment_provider, payment_metadata, shipping_address, created_at, deleted_at, customers(name,email,phone,city), order_items(id,product_name,quantity,unit_price)"
    )
    .eq("id", id)
    .maybeSingle();

  if (result.error) {
    console.error("[OrdersService:getOrderById]", result.error);
    throw result.error;
  }

  if (!result.data) return null;

  const row = result.data as unknown as RawOrderRow;

  // Treat soft-deleted orders as not found
  if (row.deleted_at) return null;

  const meta = row.payment_metadata;

  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    total: row.total,
    payment_id: row.payment_id,
    payment_provider: row.payment_provider,
    // Expose only non-sensitive fields from payment_metadata.
    // razorpay_signature is a security token and must never appear on the page.
    payment_metadata: meta
      ? {
          razorpay_order_id: meta.razorpay_order_id as string | undefined,
          request_id: meta.request_id as string | undefined,
        }
      : null,
    shipping_address: row.shipping_address as ShippingAddress | null,
    created_at: row.created_at,
    customer: row.customers
      ? {
          name: row.customers.name,
          email: row.customers.email ?? null,
          phone: row.customers.phone ?? null,
          city: row.customers.city ?? null,
        }
      : null,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/services/__tests__/orders-server.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/orders-server.ts src/lib/services/__tests__/orders-server.test.ts
git commit -m "feat(orders): add server-only getOrderById service with tests"
```

---

### Task 2: Create order details page, loading skeleton, and error boundary

**Files:**
- Create: `src/app/orders/[id]/page.tsx`
- Create: `src/app/orders/[id]/loading.tsx`
- Create: `src/app/orders/[id]/error.tsx`

**Interfaces:**
- Consumes: `getOrderById(id: string): Promise<OrderDetail | null>` from `@/lib/services/orders-server`
- Consumes: `formatCurrency(amount: number): string` from `@/lib/utils/format`
- Consumes: Next.js `params: Promise<{ id: string }>` — must be awaited (Next.js 16 convention, confirmed in `src/app/shop/[slug]/page.tsx:23`)

**Design reference:** Design language confirmed from `src/app/checkout/page.tsx` and `src/app/shop/[slug]/page.tsx`:
- Background: `bg-white` or `bg-[#faf8f5]`
- Borders: `border border-[#e8e0d5]`
- Gold accent: `text-[#c9a465]` / `border-[#c9a465]`
- Dark text: `text-[#1a1a1a]`
- Muted text: `text-[#9a9a9a]`
- Section label: `text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]`
- Heading font: `font-cormorant`
- Body font: `font-inter`
- Error boundary uses `unstable_retry` (not `retry`) — confirmed from Next.js 16 docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`

- [ ] **Step 1: Create the order details page**

Create `src/app/orders/[id]/page.tsx` with this exact content:

```tsx
import Link from "next/link";
import { getOrderById } from "@/lib/services/orders-server";
import { formatCurrency } from "@/lib/utils/format";

interface Props {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "In Production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    return (
      <main className="flex-1 bg-white min-h-[60vh] flex items-center justify-center font-inter">
        <div className="text-center space-y-4 px-4">
          <h1 className="text-2xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Order Not Found
          </h1>
          <p className="text-sm text-[#9a9a9a]">
            This order reference is invalid or may have been removed.
          </p>
          <Link
            href="/shop"
            className="inline-block text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
          >
            Browse Collection
          </Link>
        </div>
      </main>
    );
  }

  const itemsSubtotal = order.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );
  const shipping = order.total - itemsSubtotal;
  const addr = order.shipping_address;

  return (
    <main className="flex-1 bg-white py-16 font-inter">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page header */}
        <div className="border-b border-[#e8e0d5] pb-6 space-y-1">
          <p className="text-xs uppercase tracking-widest font-bold text-[#9a9a9a]">
            Order Details
          </p>
          <h1 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            {order.order_number}
          </h1>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <span className="text-xs text-[#9a9a9a]">
              Placed on {formatDate(order.created_at)}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#c9a465]">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: items + pricing */}
          <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
              Items Ordered
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#1a1a1a] leading-tight">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-[#9a9a9a] uppercase tracking-wider">
                      QTY: {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#1a1a1a] whitespace-nowrap">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <hr className="border-[#e8e0d5]" />
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#4a4a4a]">
                <span className="uppercase tracking-widest font-bold">Subtotal</span>
                <span>{formatCurrency(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-[#4a4a4a]">
                <span className="uppercase tracking-widest font-bold">Shipping</span>
                {shipping === 0 ? (
                  <span className="text-[#c9a465] uppercase font-bold tracking-widest">Free</span>
                ) : (
                  <span>{formatCurrency(shipping)}</span>
                )}
              </div>
            </div>
            <hr className="border-[#e8e0d5]" />
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#1a1a1a]">
                Total
              </span>
              <span className="text-lg font-light text-[#1a1a1a]">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>

          {/* Right: customer + shipping + payment */}
          <div className="space-y-6">
            {order.customer && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Customer
                </h2>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-[#1a1a1a]">{order.customer.name}</p>
                  {order.customer.email && (
                    <p className="text-sm text-[#4a4a4a]">{order.customer.email}</p>
                  )}
                  {order.customer.phone && (
                    <p className="text-sm text-[#4a4a4a]">{order.customer.phone}</p>
                  )}
                </div>
              </div>
            )}

            {addr && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Shipping Address
                </h2>
                <address className="not-italic text-sm text-[#4a4a4a] leading-relaxed">
                  {addr.addressLine1 && <span className="block">{addr.addressLine1}</span>}
                  {addr.addressLine2 && <span className="block">{addr.addressLine2}</span>}
                  {(addr.city || addr.state) && (
                    <span className="block">
                      {[addr.city, addr.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {addr.pincode && <span className="block">{addr.pincode}</span>}
                  {addr.country && <span className="block">{addr.country}</span>}
                </address>
              </div>
            )}

            {(order.payment_id || order.payment_metadata?.razorpay_order_id) && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Payment
                </h2>
                <div className="space-y-2">
                  {order.payment_provider && (
                    <p className="text-xs uppercase tracking-widest font-bold text-[#c9a465]">
                      {order.payment_provider}
                    </p>
                  )}
                  {order.payment_id && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-[#9a9a9a] uppercase tracking-wider font-bold">
                        Payment ID
                      </p>
                      <p className="text-xs text-[#4a4a4a] font-mono break-all">
                        {order.payment_id}
                      </p>
                    </div>
                  )}
                  {order.payment_metadata?.razorpay_order_id && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-[#9a9a9a] uppercase tracking-wider font-bold">
                        Order Reference
                      </p>
                      <p className="text-xs text-[#4a4a4a] font-mono break-all">
                        {order.payment_metadata.razorpay_order_id}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back link */}
        <div className="pt-4">
          <Link
            href="/shop"
            className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
          >
            Continue Browsing
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the loading skeleton**

Create `src/app/orders/[id]/loading.tsx` with this exact content:

```tsx
export default function OrderDetailLoading() {
  return (
    <main className="flex-1 bg-white py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-[#e8e0d5] pb-6 space-y-3">
          <div className="h-2.5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
          <div className="h-9 w-48 bg-[#e8e0d5] rounded animate-pulse" />
          <div className="h-2.5 w-64 bg-[#e8e0d5] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
            <div className="h-2.5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
            {[0, 1].map((i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-40 bg-[#e8e0d5] rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                </div>
                <div className="h-3 w-20 bg-[#e8e0d5] rounded animate-pulse flex-shrink-0" />
              </div>
            ))}
            <hr className="border-[#e8e0d5]" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-[#e8e0d5] rounded animate-pulse" />
              </div>
              <div className="flex justify-between">
                <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                <div className="h-2.5 w-12 bg-[#e8e0d5] rounded animate-pulse" />
              </div>
            </div>
            <hr className="border-[#e8e0d5]" />
            <div className="flex justify-between">
              <div className="h-3 w-12 bg-[#e8e0d5] rounded animate-pulse" />
              <div className="h-5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-3">
                <div className="h-2.5 w-20 bg-[#e8e0d5] rounded animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 bg-[#e8e0d5] rounded animate-pulse" />
                  <div className="h-3 w-48 bg-[#e8e0d5] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create the error boundary**

Create `src/app/orders/[id]/error.tsx` with this exact content:

```tsx
"use client";

import Link from "next/link";

export default function OrderError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Unable to Load Order
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          We couldn&apos;t retrieve your order details. Please try again.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={unstable_retry}
            className="text-xs uppercase tracking-widest font-bold text-white bg-[#c9a465] px-6 py-2.5 hover:bg-[#d4b87a] transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/shop"
            className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
          >
            Back to Collection
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run full test suite — confirm no regressions**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/
git commit -m "feat(orders): add order details page with loading skeleton and error boundary"
```

---

### Task 3: Minimal checkout success update — add "View Order Details" link

**Files:**
- Modify: `src/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `result.orderId` (UUID string) returned by `createOrder()` — defined at `src/lib/services/orders.ts:24` as `CreateOrderResult.orderId`, mapped from `data.order_id` at line 80
- No change to any other `createOrder` call, Razorpay logic, validation, cart clearing, or notification flow

**Exact changes — 4 surgical edits:**

- [ ] **Step 1: Add `orderUuid` state variable**

In `src/app/checkout/page.tsx`, find line 51:
```ts
  const [orderId, setOrderId] = useState<string | null>(null);
```
Replace with:
```ts
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderUuid, setOrderUuid] = useState<string | null>(null);
```

- [ ] **Step 2: Store UUID in bypass mode success block**

In `src/app/checkout/page.tsx`, find lines 194–196 (inside the bypass `if (bypass)` block):
```ts
          clearCart();
          setOrderId(result.orderNumber);
```
Replace with:
```ts
          clearCart();
          setOrderId(result.orderNumber);
          setOrderUuid(result.orderId);
```

- [ ] **Step 3: Store UUID in production payment success handler**

In `src/app/checkout/page.tsx`, find lines 257–259 (inside the Razorpay `handler` callback):
```ts
            clearCart();
            setOrderId(result.orderNumber);
```
Replace with:
```ts
            clearCart();
            setOrderId(result.orderNumber);
            setOrderUuid(result.orderId);
```

- [ ] **Step 4: Add "View Order Details" link on success screen**

In `src/app/checkout/page.tsx`, find lines 326–333 (the success screen CTA div):
```tsx
          <div className="pt-4">
            <Link
              href="/shop"
              className="inline-block bg-[#1a1a1a] text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#333333] transition-colors"
            >
              Continue Browsing
            </Link>
          </div>
```
Replace with:
```tsx
          <div className="pt-4 flex flex-col items-center gap-3">
            <Link
              href="/shop"
              className="inline-block bg-[#1a1a1a] text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#333333] transition-colors"
            >
              Continue Browsing
            </Link>
            {orderUuid && (
              <Link
                href={`/orders/${orderUuid}`}
                className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
              >
                View Order Details
              </Link>
            )}
          </div>
```

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
npm test
```

Expected: All tests PASS. (Checkout tests mock `createOrder` and don't render the success JSX, so no test changes are needed.)

- [ ] **Step 6: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat(checkout): add View Order Details link on success screen"
```

---

## Phase 3 — Security Validation

Before marking the feature complete, verify each item:

| Check | Verification method | Pass condition |
|-------|---------------------|----------------|
| UUID enumeration | Math: 2^122 UUID v4 space. At 10^9 guesses/sec, full enumeration takes 10^19 years. | Pass — infeasible |
| Service role key not in client bundle | `grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/` | Zero matches |
| `orders-server.ts` not bundled for client | `grep -r "orders-server" .next/static/` | Zero matches |
| `razorpay_signature` not rendered | Search page HTML for "signature" | Zero matches |
| `deleted_at` orders return "not found" | In test: `getOrderById` returns null for `deleted_at !== null` | Covered by Task 1 test "returns null when order is soft-deleted" |
| No cross-customer data leakage | UUID is the only access control; each UUID is 128-bit random | Architecture guarantee |
| SSR only — no client fetch | No `useEffect`, `useSWR`, or `fetch` in `orders/[id]/page.tsx` | Page is `async function` with no `"use client"` |
| Caching disabled | Route is dynamic (no `generateStaticParams`, no `'use cache'`) | Dynamic by default in Next.js 16 |

---

## Phase 4 — Regression Matrix

### Checkout (most critical — must not touch payment flow)

| Scenario | Expected behavior | How to verify |
|----------|-------------------|---------------|
| Payment bypass mode order creation | `createOrder` called, `clearCart` called, success screen shown with order_number | `npm test` — existing checkout tests cover this |
| Production Razorpay payment | Razorpay modal opens, handler calls `createOrder`, success screen shown | Manual test with real Razorpay test keys |
| Cart clearing on success | `clearCart()` called — cart empties after order | Check cart is empty after success screen |
| Success screen shows order reference | `{orderId}` = `result.orderNumber` renders as "Order Reference: #ORD-XXXX" | Visual check on success screen |
| "View Order Details" link appears | `orderUuid` set → link renders → navigates to `/orders/{uuid}` | Visual check on success screen |
| Payment failure / modal dismiss | `setIsSubmitting(false)` — no cart clear, no order created | Test by closing Razorpay modal |
| Validation errors | Form shows field errors, no payment initiated | Test with empty form fields |

### Notifications (must remain unchanged)
The checkout page calls `createOrder` → edge function → `create_order_txn` RPC → (via DB trigger or separate mechanism) → enqueues notifications. **No code in the notification pipeline was touched.** Run: `npm test` — all notification service tests pass.

### Admin application (must remain unchanged)
Admin reads orders using `is_admin()` RLS policy — service role client with auth session. **No admin code was touched.** Admin order list and detail pages are unaffected.

### Storefront pages (must remain unchanged)

| Page | Potential impact | Verdict |
|------|-----------------|---------|
| `/` (home) | None — no shared state | Not affected |
| `/shop` | None | Not affected |
| `/shop/[slug]` (product detail) | None | Not affected |
| `/cart` | None — cart store unmodified | Not affected |
| `/checkout` | Added 1 state var + 1 link — no logic change | Verify: payment, success, cart clear still work |
| `/contact` | None | Not affected |
| `/new-arrivals` | None | Not affected |
| `/atelier` | None | Not affected |

---

## Phase 5 — Production Validation Plan

Run after deployment. Execute in order.

**Step 1: Place a test order in production**
1. Add a product to cart
2. Complete checkout with test card details (Razorpay test mode: card 4111 1111 1111 1111, any future expiry, any CVV)
3. Observe success screen shows: order reference number + "View Order Details" link

**Step 2: Verify database records**
In Supabase dashboard → Table Editor:
```sql
SELECT o.id, o.order_number, o.status, o.total, o.payment_id, o.payment_provider,
       o.shipping_address, o.created_at, o.deleted_at,
       c.name, c.email, c.phone
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.created_at DESC LIMIT 1;
```
Verify: `status = 'PENDING'`, `payment_id` set, `shipping_address` JSON has correct keys, `deleted_at` is null.

```sql
SELECT * FROM order_items WHERE order_id = '<uuid from above>';
```
Verify: `product_name` matches cart item, `unit_price` matches product price, `product_snapshot` is null (expected for storefront checkout).

**Step 3: Verify order details page loads**
1. Click "View Order Details" on success screen → page loads at `/orders/{uuid}`
2. Verify displayed: order_number, status ("Pending"), date, item names, quantities, unit prices, subtotal, shipping, total, customer name, email, phone, shipping address, payment_id, Razorpay order reference
3. Verify NOT displayed: razorpay_signature, service role key, any internal UUID other than the page URL

**Step 4: Verify direct URL navigation**
1. Copy the `/orders/{uuid}` URL
2. Open in incognito browser (no session)
3. Verify: page still loads (no auth required, URL-based access)

**Step 5: Verify UUID security**
1. Modify the UUID in the URL to a random UUID
2. Verify: custom "Order Not Found" UI appears (NOT generic Next.js 404)

**Step 6: Verify soft-deleted order**
1. In Supabase dashboard, set `deleted_at = now()` on the test order
2. Reload the order page
3. Verify: custom "Order Not Found" UI appears

**Step 7: Mobile verification**
1. Open order details page on mobile viewport (375px)
2. Verify: two-column layout stacks to single column
3. Verify: all text readable, no overflow

**Step 8: Regression — existing checkout still works**
1. Place another test order
2. Verify: success screen appears normally
3. Verify: cart is empty after success
4. Verify: notifications received (customer confirmation email, admin email)

---

## Self-Review

### Spec Coverage

| Dinesh requirement | Covered by |
|---|---|
| What they ordered (items, qty, price) | Task 2 page — "Items Ordered" card, snapshot values from `order_items.product_name` and `unit_price` |
| Order total | Task 2 page — "Total" row in items card |
| Address submitted during checkout | Task 2 page — "Shipping Address" card from `orders.shipping_address` JSONB |
| Phone number submitted during checkout | Task 2 page — "Customer" card shows `customers.phone` |
| Payment details/reference | Task 2 page — "Payment" card shows `payment_id` and `payment_metadata.razorpay_order_id` |
| Order status | Task 2 page — status badge in header showing `STATUS_LABELS[order.status]` |
| Route exists (no 404) | Task 2 creates `src/app/orders/[id]/page.tsx` |
| User can navigate to it after checkout | Task 3 adds "View Order Details" link to checkout success screen |

### Constraint Coverage

| Constraint | Verified |
|---|---|
| Do NOT modify Edge Function | ✓ No changes to `mei-admin/supabase/functions/` |
| Do NOT modify notification pipeline | ✓ No changes to notification code |
| Do NOT modify Mailgun/WhatsApp | ✓ Not touched |
| Do NOT modify Razorpay logic | ✓ No changes to `src/app/api/razorpay/` |
| Do NOT modify existing checkout validation | ✓ Validation code (`validate()`) unchanged |
| Do NOT modify DB schema | ✓ No new migrations |
| Do NOT refactor unrelated files | ✓ Only the 3 new files + minimal checkout edit |
| Do NOT introduce new dependencies | ✓ Uses only existing packages |
| No mutable product catalog lookups | ✓ Uses `order_items.product_name` and `unit_price` (snapshots), no `products` join |
| No `razorpay_signature` display | ✓ Excluded in `getOrderById` — only `razorpay_order_id` and `request_id` from metadata |

### Placeholder Scan

All steps contain complete code. No TBDs, no "add appropriate error handling", no "similar to Task N".

### Type Consistency

| Symbol | Defined in | Used in |
|---|---|---|
| `OrderDetail` | `orders-server.ts` | Task 1 tests (imported), Task 2 page (via `getOrderById` return type) |
| `OrderItem` | `orders-server.ts` | `OrderDetail.items` (array member) |
| `OrderCustomer` | `orders-server.ts` | `OrderDetail.customer` |
| `ShippingAddress` | `orders-server.ts` | `OrderDetail.shipping_address` |
| `getOrderById` | `orders-server.ts` | Task 2 page: `const order = await getOrderById(id)` |
| `order.items.map(item => item.unit_price * item.quantity)` | page uses `OrderItem.unit_price`, `OrderItem.quantity` | Matches type definition |
| `order.payment_metadata?.razorpay_order_id` | page accesses `OrderDetail.payment_metadata.razorpay_order_id` | Matches type: `{ razorpay_order_id?: string }` |
| `result.orderId` | `CreateOrderResult.orderId` at `orders.ts:24` | Task 3: `setOrderUuid(result.orderId)` |
| `STATUS_LABELS[order.status]` | `order.status: string` | `STATUS_LABELS: Record<string, string>` — always produces string or undefined (fallback `?? order.status`) |
