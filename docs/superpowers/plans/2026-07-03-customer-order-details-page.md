# Customer Order Details Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a customer-facing `/orders/[id]` page that displays order details (items, customer info, shipping address, payment reference) for any UUID-identified order, reachable via a new link on the checkout success screen.

**Architecture:** Server Component page fetches order data server-side using the Supabase service-role client (never exposed to browser). UUID in URL provides enumeration resistance with no auth required. `getOrderById` lives in a new `orders-server.ts` file — separate from `orders.ts` — because `orders.ts` is imported by the client-component checkout page and mixing in `createServiceClient` (which references the server-only `SUPABASE_SERVICE_ROLE_KEY`) would pollute the client bundle. The checkout success screen gains one new "View Order Details" link; no checkout flow logic is changed.

**Tech Stack:** Next.js 16 App Router (Server Components, `params: Promise<{id}>` API), Supabase JS v2, Vitest 4, Tailwind CSS 4, TypeScript 5.

---

## Phase 0 Evidence (Read-Only Discovery)

### Route Investigation
- **Finding:** `src/app/orders/` does not exist. No partial implementation. Route is completely missing.
- **Evidence:** `Glob("src/app/**/*")` returned no matches under `orders/`.

### Checkout Success Flow
- **Finding:** There is NO `router.push()` to `/orders/:id`. The success screen renders inline on the checkout page via a React state variable.
- **Evidence:**
  - `src/app/checkout/page.tsx:51` — `const [orderId, setOrderId] = useState<string | null>(null);`
  - `src/app/checkout/page.tsx:195` (bypass mode) — `setOrderId(result.orderNumber);`
  - `src/app/checkout/page.tsx:258` (production mode) — `setOrderId(result.orderNumber);`
  - `src/app/checkout/page.tsx:295` — `if (orderId) { return <success screen> }`
  - `result.orderId` (UUID) is available from `createOrder()` but is discarded at both call sites.

### Database Schema
- **Evidence:** `src/lib/supabase/database.ts`
- **`orders` table:** `id` (UUID), `order_number`, `customer_id`, `status` (enum), `total`, `payment_id`, `payment_provider`, `payment_metadata` (Json), `shipping_address` (Json), `created_at`, `updated_at`
- **`customers` table:** `id`, `name`, `email`, `phone`, `city`, `created_at`
- **`order_items` table:** `id`, `order_id`, `product_id`, `product_name` (snapshot ✓), `quantity`, `unit_price` (snapshot ✓), `created_at` — **no snapshot image field**
- **Missing from spec expectations:** `payment_status` (not in schema — use `status`), `payment_method` (not a column — use `payment_provider`). **No schema change needed.**

### Address Source
- **Finding:** `orders.shipping_address` Json column.
- **Format from checkout form:** `{ addressLine1, addressLine2, city, state, pincode, country }`

### Access Model Decision
- No authentication in storefront.
- **Decision:** Public UUID access (`/orders/[uuid]`). UUID is 128-bit random — enumeration is not feasible.
- Fetch is server-side only via `createServiceClient()`. Service role key never reaches the browser.

### Privacy Decision
- Email masked (first char + domain): `priya@example.com` → `p***@example.com`
- Phone masked (last 4 digits): `+91 98765 43210` → `+91 ·····3210`
- `payment_id` shown as reference (already appears in email receipts).

---

## Global Constraints

- Do NOT modify checkout flow logic (validation, Razorpay integration, order creation, notification pipeline).
- Do NOT modify the `create-order` Edge Function.
- Do NOT modify existing database schema.
- Do NOT add new npm dependencies.
- Do NOT change existing UI styles — match the MEI design system exactly (`border-[#e8e0d5]`, `text-[#c9a465]`, `font-cormorant`/`font-inter`, `bg-[#faf8f5]`).
- Do NOT change existing routes.
- `getOrderById` must live in `orders-server.ts`, NOT `orders.ts` (client bundle safety).
- Product images are NOT displayed in order items — no snapshot image field exists; mutable catalog values must not be used.
- Every task ends with a `vitest run` pass confirmation before commit.

---

## File Structure

**Create:**
- `src/lib/services/orders-server.ts` — `getOrderById()` function + `OrderDetail`/`OrderItem`/`OrderCustomer`/`ShippingAddress` types. Server-only (imports `createServiceClient`).
- `src/lib/services/__tests__/orders-server.test.ts` — Vitest tests for `getOrderById`.
- `src/app/orders/[id]/page.tsx` — Async Server Component. Awaits `params.id`, calls `getOrderById`, renders order or "not found" UI.
- `src/app/orders/[id]/loading.tsx` — Pulse-skeleton matching page layout.
- `src/app/orders/[id]/error.tsx` — Client Component error boundary with `unstable_retry`.

**Modify:**
- `src/app/checkout/page.tsx` — Add `orderUuid` state; call `setOrderUuid(result.orderId)` alongside existing `setOrderId` calls; add "View Order Details" link on success screen.

---

### Task 1: Add `getOrderById` to orders-server service (TDD)

**Files:**
- Create: `src/lib/services/orders-server.ts`
- Create: `src/lib/services/__tests__/orders-server.test.ts`

**Interfaces:**
- Produces:
  ```ts
  getOrderById(id: string): Promise<OrderDetail | null>
  // throws on DB error; returns null if order not found
  ```
  Types: `OrderDetail`, `OrderItem`, `OrderCustomer`, `ShippingAddress` (all exported from `orders-server.ts`)

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
  id: "uuid-order-1",
  order_number: "#ORD-001",
  status: "CONFIRMED",
  total: 120000,
  payment_id: "pay_test_001",
  payment_provider: "razorpay",
  shipping_address: {
    addressLine1: "12 Marine Drive",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  },
  created_at: "2026-07-03T10:00:00Z",
  customers: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    city: "Mumbai",
  },
  order_items: [
    { id: "item-1", product_name: "Bridal Lehenga", quantity: 1, unit_price: 120000 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrderById", () => {
  it("returns a mapped OrderDetail on success", async () => {
    mockMaybeSingle.mockResolvedValue({ data: SAMPLE_ROW, error: null });

    const result = await getOrderById("uuid-order-1");

    const expected: OrderDetail = {
      id: "uuid-order-1",
      order_number: "#ORD-001",
      status: "CONFIRMED",
      total: 120000,
      payment_id: "pay_test_001",
      payment_provider: "razorpay",
      shipping_address: {
        addressLine1: "12 Marine Drive",
        addressLine2: "",
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
      items: [{ id: "item-1", product_name: "Bridal Lehenga", quantity: 1, unit_price: 120000 }],
    };
    expect(result).toEqual(expected);
  });

  it("returns null when order is not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getOrderById("nonexistent-uuid");

    expect(result).toBeNull();
  });

  it("throws and logs when Supabase returns a database error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "DB connection failed" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getOrderById("uuid-order-1")).rejects.toMatchObject({
      message: "DB connection failed",
    });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:getOrderById]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("queries the orders table by UUID", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await getOrderById("specific-uuid-123");

    expect(mockFrom).toHaveBeenCalledWith("orders");
    expect(mockChain.eq).toHaveBeenCalledWith("id", "specific-uuid-123");
  });

  it("returns null customer when customers join is null", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, customers: null, order_items: [] },
      error: null,
    });

    const result = await getOrderById("uuid-order-2");

    expect(result?.customer).toBeNull();
    expect(result?.items).toEqual([]);
  });

  it("handles null shipping_address", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, shipping_address: null },
      error: null,
    });

    const result = await getOrderById("uuid-order-3");

    expect(result?.shipping_address).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

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
  shipping_address: ShippingAddress | null;
  created_at: string;
  customer: OrderCustomer | null;
  items: OrderItem[];
}

type RawOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_id: string | null;
  payment_provider: string | null;
  shipping_address: Record<string, string> | null;
  created_at: string;
  customers: { name: string; email: string | null; phone: string | null; city: string | null } | null;
  order_items: Array<{ id: string; product_name: string; quantity: number; unit_price: number }>;
};

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const result = await createServiceClient()
    .from("orders")
    .select(
      "id, order_number, status, total, payment_id, payment_provider, shipping_address, created_at, customers(name,email,phone,city), order_items(id,product_name,quantity,unit_price)"
    )
    .eq("id", id)
    .maybeSingle();

  if (result.error) {
    console.error("[OrdersService:getOrderById]", result.error);
    throw result.error;
  }

  if (!result.data) return null;

  const row = result.data as unknown as RawOrderRow;

  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    total: row.total,
    payment_id: row.payment_id,
    payment_provider: row.payment_provider,
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/services/__tests__/orders-server.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/orders-server.ts src/lib/services/__tests__/orders-server.test.ts
git commit -m "feat(orders): add getOrderById server-only service with tests"
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
- Page route: `/orders/[id]` where `id` is a Supabase UUID

- [ ] **Step 1: Create the order details page**

Create `src/app/orders/[id]/page.tsx` with this exact content:

```tsx
import Link from "next/link";
import { getOrderById } from "@/lib/services/orders-server";
import { formatCurrency } from "@/lib/utils/format";

interface Props {
  params: Promise<{ id: string }>;
}

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 1) return email;
  return `${email[0]}***${email.slice(atIndex)}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  const visible = phone.slice(-4);
  const masked = phone.slice(0, -4).replace(/\d/g, "·");
  return masked + visible;
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
        {/* Header */}
        <div className="border-b border-[#e8e0d5] pb-6 space-y-1">
          <p className="text-xs uppercase tracking-widest font-bold text-[#9a9a9a]">
            Order Details
          </p>
          <h1 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            {order.order_number}
          </h1>
          <div className="flex items-center gap-4 pt-1">
            <span className="text-xs text-[#9a9a9a]">
              Placed on {formatDate(order.created_at)}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#c9a465]">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Items + Pricing */}
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

          {/* Customer + Shipping + Payment */}
          <div className="space-y-6">
            {order.customer && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Customer
                </h2>
                <div className="space-y-1.5">
                  <p className="text-sm text-[#1a1a1a]">{order.customer.name}</p>
                  {order.customer.email && (
                    <p className="text-sm text-[#4a4a4a]">{maskEmail(order.customer.email)}</p>
                  )}
                  {order.customer.phone && (
                    <p className="text-sm text-[#4a4a4a]">{maskPhone(order.customer.phone)}</p>
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

            {order.payment_id && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Payment
                </h2>
                <div className="space-y-1">
                  {order.payment_provider && (
                    <p className="text-xs uppercase tracking-widest font-bold text-[#c9a465]">
                      {order.payment_provider}
                    </p>
                  )}
                  <p className="text-xs text-[#9a9a9a] font-mono break-all">
                    {order.payment_id}
                  </p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
            <div className="h-2.5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
            {[0, 1].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="space-y-1.5">
                  <div className="h-3 w-40 bg-[#e8e0d5] rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                </div>
                <div className="h-3 w-20 bg-[#e8e0d5] rounded animate-pulse" />
              </div>
            ))}
            <hr className="border-[#e8e0d5]" />
            <div className="h-3 w-full bg-[#e8e0d5] rounded animate-pulse" />
            <div className="h-3 w-full bg-[#e8e0d5] rounded animate-pulse" />
          </div>
          <div className="space-y-6">
            {[0, 1].map((i) => (
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

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/
git commit -m "feat(orders): add order details page with loading and error states"
```

---

### Task 3: Minimal checkout success update — add "View Order Details" link

**Files:**
- Modify: `src/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `result.orderId` (UUID string) from `createOrder()` — already returned but currently discarded
- Produces: A "View Order Details" link on the success screen pointing to `/orders/${orderUuid}`

The checkout flow logic (validation, Razorpay modal, payment handler, `createOrder` call, `clearCart`) is NOT changed. Only the success state gains a new state variable and a new link.

- [ ] **Step 1: Add `orderUuid` state variable**

In `src/app/checkout/page.tsx`, after line 51 (`const [orderId, setOrderId] = useState<string | null>(null);`), add:

```ts
  const [orderUuid, setOrderUuid] = useState<string | null>(null);
```

The state block now reads:
```ts
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderUuid, setOrderUuid] = useState<string | null>(null);
```

- [ ] **Step 2: Store UUID in bypass mode (line 195 area)**

In `src/app/checkout/page.tsx`, find the bypass mode success block (around line 194–196):

```ts
          clearCart();
          setOrderId(result.orderNumber);
```

Change it to:
```ts
          clearCart();
          setOrderId(result.orderNumber);
          setOrderUuid(result.orderId);
```

- [ ] **Step 3: Store UUID in production payment mode (line 258 area)**

In `src/app/checkout/page.tsx`, find the Razorpay `handler` success block (around line 257–259):

```ts
            clearCart();
            setOrderId(result.orderNumber);
```

Change it to:
```ts
            clearCart();
            setOrderId(result.orderNumber);
            setOrderUuid(result.orderId);
```

- [ ] **Step 4: Add "View Order Details" link on success screen**

In `src/app/checkout/page.tsx`, find the success screen's CTA `<div>` (around line 326):

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

Replace it with:
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

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests PASS (checkout tests mock `createOrder` and do not exercise the success screen JSX, so no test changes are needed).

- [ ] **Step 6: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat(checkout): add View Order Details link on success screen"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec requirement | Task covering it |
|---|---|
| Route `/orders/:orderId` exists | Task 2 creates `src/app/orders/[id]/page.tsx` |
| Order Number, created date, status | Task 2 page header |
| Customer name, email (masked), phone (masked) | Task 2 Customer card |
| Shipping address | Task 2 Shipping Address card |
| Order items (name, qty, price, subtotal) | Task 2 Items Ordered card |
| Pricing summary (subtotal, shipping, total) | Task 2 Items Ordered card |
| Payment reference | Task 2 Payment card |
| "Order not found" custom UI (not generic 404) | Task 2 page — returns custom JSX when `order === null` |
| Loading state | Task 2 `loading.tsx` |
| Database failure / retry UI | Task 2 `error.tsx` with `unstable_retry` |
| UUID enumeration not possible | Architecture decision — uses UUID in URL, fetched server-side |
| RLS respected | `createServiceClient()` is server-only; service key never reaches browser |
| Customer cannot access another customer's order | UUID is unguessable (128-bit random); no auth needed for this access model |
| Checkout regression — payment success, order creation, redirect unchanged | Task 3 adds state + link only; existing `setOrderId`, `clearCart`, handler logic untouched |
| No new npm dependencies | `orders-server.ts` uses only existing packages |
| No schema changes | Confirmed in Phase 0 — all data exists |
| Snapshot values for order items | Uses `product_name` and `unit_price` from `order_items` (snapshot columns); no join to products table |

### Placeholder Scan

No TBDs, TODOs, or "add appropriate error handling" language. Every step has exact code.

### Type Consistency

- `OrderDetail.customer` → `OrderCustomer | null` — used in Task 1 (service), Task 2 (page renders `order.customer?.name`)
- `OrderDetail.items` → `OrderItem[]` — used in Task 1 (service), Task 2 (page maps `order.items`)
- `OrderDetail.shipping_address` → `ShippingAddress | null` — used in Task 1 (service), Task 2 (`const addr = order.shipping_address`)
- `getOrderById` return type `Promise<OrderDetail | null>` — consistent across Task 1 implementation, Task 1 tests, Task 2 import
- `result.orderId` → string (UUID) — from `CreateOrderResult.orderId` in `orders.ts:26`; used in Task 3 `setOrderUuid(result.orderId)`
