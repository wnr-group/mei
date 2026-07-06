# Razorpay Hosted Checkout Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `setTimeout` in `checkout/page.tsx` with a real Razorpay standard hosted checkout modal that creates a confirmed DB order on payment success.

**Architecture:** The client calls a server-side Next.js API route to create a Razorpay order (keeping the secret key server-only), then loads the Razorpay SDK and opens the modal with that order ID. On payment success, a second API route writes the customer + order + order_items to Supabase using the service client. On dismiss the page state resets with the cart intact.

**Tech Stack:** Next.js 16 App Router API routes, Razorpay Checkout.js v1, Supabase (service-client), Vitest for unit tests.

## ⚠ Schema Note

The Edge Function at `mei-admin/supabase/functions/create-order/index.ts` was written for a variant-based schema (`product_variants`, `order_item_measurements`, `user_id`) that does **not** match the actual MEI DB schema in `src/lib/supabase/database.ts` (which uses `customers`, `orders`, `order_items` with simpler columns). **Do not call that Edge Function.** Post-payment order creation is done directly via the service client in the API route defined in Task 3.

## Global Constraints

- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — client-safe, already in `.env.local`; never use `RAZORPAY_KEY_SECRET` outside server-side code
- `RAZORPAY_KEY_SECRET` — server-only; must never appear in any client bundle or `NEXT_PUBLIC_*` variable
- Amount to Razorpay is always in **paise** (integer): `Math.round(grandTotal * 100)`
- Currency: `"INR"` hardcoded
- All payment modes enabled — do **not** set `config.display.hide_topbar` or `method` restrictions in Razorpay options
- GST-inclusive: `grandTotal` from the checkout page already includes GST — pass it as-is
- Test mode keys only (`rzp_test_*`); no live-key switch in this plan
- Use `createServiceClient()` from `src/lib/supabase/service-client.ts` for all server-side DB writes

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `src/types/razorpay.d.ts` | Minimal `window.Razorpay` type declarations |
| Create | `src/lib/razorpay/load-sdk.ts` | Promise-based Razorpay SDK script loader |
| Create | `src/app/api/checkout/razorpay-order/route.ts` | POST: create Razorpay order, returns `{id, amount, currency}` |
| Create | `src/app/api/checkout/confirm-order/route.ts` | POST: write customer + order + order_items to DB |
| Create | `src/app/api/checkout/__tests__/razorpay-order.test.ts` | Unit tests for razorpay-order route handler |
| Create | `src/app/api/checkout/__tests__/confirm-order.test.ts` | Unit tests for confirm-order route handler |
| Modify | `src/app/checkout/page.tsx` | Replace fake submit with real Razorpay flow |
| Modify | `.env.example` | Add Razorpay key placeholders |

---

## Task 1: Razorpay Type Declarations + SDK Loader

**Files:**
- Create: `src/types/razorpay.d.ts`
- Create: `src/lib/razorpay/load-sdk.ts`

**Interfaces:**
- Produces: `RazorpayOptions`, `RazorpayResponse` types for use in `checkout/page.tsx`; `loadRazorpaySDK(): Promise<void>` for calling before opening the modal

---

- [ ] **Step 1: Create Razorpay type declarations**

Create `src/types/razorpay.d.ts`:

```typescript
export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void };
  }
}
```

- [ ] **Step 2: Create SDK loader**

Create `src/lib/razorpay/load-sdk.ts`:

```typescript
const RAZORPAY_SCRIPT_ID = "razorpay-checkout-js";
const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpaySDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("loadRazorpaySDK must be called in a browser context"));
      return;
    }
    if (document.getElementById(RAZORPAY_SCRIPT_ID)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/razorpay.d.ts src/lib/razorpay/load-sdk.ts
git commit -m "feat: add Razorpay type declarations and SDK loader utility"
```

---

## Task 2: API Route — Create Razorpay Order

**Files:**
- Create: `src/app/api/checkout/razorpay-order/route.ts`
- Create: `src/app/api/checkout/__tests__/razorpay-order.test.ts`

**Interfaces:**
- Consumes: `POST` body `{ amount_paise: number }` where `amount_paise = Math.round(grandTotal * 100)`
- Produces: `{ id: string; amount: number; currency: string }` (Razorpay order object subset)

---

- [ ] **Step 1: Write the failing test**

Create `src/app/api/checkout/__tests__/razorpay-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.RAZORPAY_KEY_SECRET = "test_secret";

const { POST } = await import("../razorpay-order/route");

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/checkout/razorpay-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/checkout/razorpay-order", () => {
  it("returns 400 when amount_paise is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/amount_paise/);
  });

  it("returns 400 when amount_paise is not a positive integer", async () => {
    const res = await POST(makeRequest({ amount_paise: -100 }));
    expect(res.status).toBe(400);
  });

  it("forwards Razorpay API response on success", async () => {
    const razorpayOrder = { id: "order_test123", amount: 50000, currency: "INR" };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(razorpayOrder), { status: 200 })
    );

    const res = await POST(makeRequest({ amount_paise: 50000 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("order_test123");
    expect(json.amount).toBe(50000);
    expect(json.currency).toBe("INR");
  });

  it("returns 502 when Razorpay API returns non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 })
    );

    const res = await POST(makeRequest({ amount_paise: 50000 }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/checkout/__tests__/razorpay-order.test.ts
```

Expected: FAIL — `../razorpay-order/route` module not found

- [ ] **Step 3: Create the API route**

Create `src/app/api/checkout/razorpay-order/route.ts`:

```typescript
import { NextResponse } from "next/server";

const RAZORPAY_API = "https://api.razorpay.com/v1/orders";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { amount_paise } = body as { amount_paise?: unknown };

  if (typeof amount_paise !== "number" || !Number.isInteger(amount_paise) || amount_paise <= 0) {
    return NextResponse.json(
      { error: "amount_paise must be a positive integer (amount in paise)" },
      { status: 400 }
    );
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const rzpRes = await fetch(RAZORPAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount: amount_paise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    }),
  });

  if (!rzpRes.ok) {
    const err = await rzpRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Razorpay order creation failed", detail: err },
      { status: 502 }
    );
  }

  const order = await rzpRes.json();
  return NextResponse.json({ id: order.id, amount: order.amount, currency: order.currency });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/checkout/__tests__/razorpay-order.test.ts
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/razorpay-order/route.ts src/app/api/checkout/__tests__/razorpay-order.test.ts
git commit -m "feat: add /api/checkout/razorpay-order route to create Razorpay order server-side"
```

---

## Task 3: API Route — Confirm Order (post-payment DB write)

**Files:**
- Create: `src/app/api/checkout/confirm-order/route.ts`
- Create: `src/app/api/checkout/__tests__/confirm-order.test.ts`

**Interfaces:**
- Consumes: POST body:
  ```typescript
  {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    customer: {
      name: string;
      email: string;
      phone: string;
      city: string;
    };
    shipping_address: string; // formatted full address string
    items: Array<{
      id: string;      // product_id (from CartItem.id)
      name: string;
      price: number;   // unit price in rupees
      quantity: number;
    }>;
    total: number;     // grand total in rupees (matches razorpay amount / 100)
  }
  ```
- Produces: `{ order_number: string }` on success; `{ error: string }` on failure

**DB writes (using `createServiceClient()`):**
1. Upsert `customers` by email → get `customer_id`
2. Insert `orders` → get `order_number`
3. Insert `order_items` for each cart item

---

- [ ] **Step 1: Write the failing test**

Create `src/app/api/checkout/__tests__/confirm-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpsert = vi.fn();
const mockInsertOrder = vi.fn();
const mockInsertItems = vi.fn();

vi.mock("@/lib/supabase/service-client", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "customers") {
        return {
          upsert: mockUpsert,
        };
      }
      if (table === "orders") {
        return {
          insert: mockInsertOrder,
        };
      }
      if (table === "order_items") {
        return {
          insert: mockInsertItems,
        };
      }
    },
  }),
}));

const { POST } = await import("../confirm-order/route");

const validBody = {
  razorpay_payment_id: "pay_test123",
  razorpay_order_id: "order_test123",
  razorpay_signature: "sig_test",
  customer: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 99999 00000",
    city: "Mumbai",
  },
  shipping_address: "42 Marine Drive, Mumbai, Maharashtra 400001",
  items: [
    { id: "prod-1", name: "Bridal Lehenga", price: 45000, quantity: 1 },
  ],
  total: 45150,
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/checkout/confirm-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockReturnValue({
    select: () => ({
      single: () => Promise.resolve({ data: { id: "cust-uuid-1" }, error: null }),
    }),
  });
  mockInsertOrder.mockReturnValue({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: { id: "order-uuid-1", order_number: "MEI-000001" },
          error: null,
        }),
    }),
  });
  mockInsertItems.mockResolvedValue({ error: null });
});

describe("POST /api/checkout/confirm-order", () => {
  it("returns order_number on success", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.order_number).toBe("MEI-000001");
  });

  it("upserts customer with correct fields", async () => {
    await POST(makeRequest(validBody));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Priya Sharma",
        email: "priya@example.com",
        phone: "+91 99999 00000",
        city: "Mumbai",
      }),
      expect.objectContaining({ onConflict: "email" })
    );
  });

  it("creates order with correct total and notes", async () => {
    await POST(makeRequest(validBody));
    expect(mockInsertOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: "cust-uuid-1",
        total: 45150,
        status: "PENDING",
      })
    );
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest({ razorpay_payment_id: "pay_x" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when customer upsert fails", async () => {
    mockUpsert.mockReturnValue({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: { message: "DB error" } }),
      }),
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/checkout/__tests__/confirm-order.test.ts
```

Expected: FAIL — `../confirm-order/route` module not found

- [ ] **Step 3: Create the API route**

Create `src/app/api/checkout/confirm-order/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service-client";

interface ConfirmOrderBody {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
  };
  shipping_address: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as ConfirmOrderBody | null;

  if (
    !body ||
    !body.razorpay_payment_id ||
    !body.customer?.email ||
    !body.customer?.name ||
    !body.items?.length ||
    typeof body.total !== "number"
  ) {
    return NextResponse.json(
      { error: "Missing required fields: razorpay_payment_id, customer, items, total" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // 1. Upsert customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        name: body.customer.name,
        email: body.customer.email,
        phone: body.customer.phone,
        city: body.customer.city,
      },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      { error: "Failed to create customer record" },
      { status: 500 }
    );
  }

  // 2. Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      total: body.total,
      status: "PENDING",
      notes: JSON.stringify({
        shipping_address: body.shipping_address,
        razorpay_payment_id: body.razorpay_payment_id,
        razorpay_order_id: body.razorpay_order_id,
      }),
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }

  // 3. Create order items
  const orderItems = body.items.map((item) => ({
    order_id: order.id,
    product_id: item.id,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    return NextResponse.json(
      { error: "Failed to save order items" },
      { status: 500 }
    );
  }

  return NextResponse.json({ order_number: order.order_number });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/app/api/checkout/__tests__/confirm-order.test.ts
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/checkout/confirm-order/route.ts src/app/api/checkout/__tests__/confirm-order.test.ts
git commit -m "feat: add /api/checkout/confirm-order route to persist order after payment"
```

---

## Task 4: Wire Razorpay into `checkout/page.tsx`

**Files:**
- Modify: `src/app/checkout/page.tsx`

**Interfaces:**
- Consumes:
  - `loadRazorpaySDK()` from `@/lib/razorpay/load-sdk`
  - `RazorpayOptions`, `RazorpayResponse` from `@/types/razorpay`
  - `POST /api/checkout/razorpay-order` → `{ id, amount, currency }`
  - `POST /api/checkout/confirm-order` → `{ order_number }`
- Produces: calls `clearCart()` and `setOrderId(order_number)` on success

---

- [ ] **Step 1: Replace `handleSubmit` in `checkout/page.tsx`**

Replace the entire `handleSubmit` function (lines 105–118) and add the `paymentError` state:

After the `isSubmitting` state declaration (line 64), add:
```typescript
const [paymentError, setPaymentError] = useState<string | null>(null);
```

Replace the `handleSubmit` function body:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;

  setIsSubmitting(true);
  setPaymentError(null);

  try {
    // 1. Create Razorpay order server-side
    const rzpOrderRes = await fetch("/api/checkout/razorpay-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount_paise: Math.round(grandTotal * 100) }),
    });

    if (!rzpOrderRes.ok) {
      const err = await rzpOrderRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to initiate payment");
    }

    const rzpOrder = await rzpOrderRes.json();

    // 2. Load Razorpay SDK and open modal
    await loadRazorpaySDK();

    await new Promise<void>((resolve, reject) => {
      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        order_id: rzpOrder.id,
        name: "MEI Atelier",
        description: "Handcrafted Bridal Pieces",
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: { color: "#c9a465" },
        handler: async (response: RazorpayResponse) => {
          try {
            // 3. Confirm order in DB
            const confirmRes = await fetch("/api/checkout/confirm-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                customer: {
                  name: formData.name,
                  email: formData.email,
                  phone: formData.phone,
                  city: formData.city,
                },
                shipping_address: [
                  formData.addressLine1,
                  formData.addressLine2,
                  formData.city,
                  formData.state,
                  formData.pincode,
                  formData.country,
                ]
                  .filter(Boolean)
                  .join(", "),
                items: items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                })),
                total: grandTotal,
              }),
            });

            if (!confirmRes.ok) {
              const err = await confirmRes.json().catch(() => ({}));
              throw new Error(err.error ?? "Order confirmation failed");
            }

            const { order_number } = await confirmRes.json();
            clearCart();
            setOrderId(order_number);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            resolve(); // modal dismissed — not an error
          },
        },
      };

      new window.Razorpay(options).open();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment could not be completed";
    setPaymentError(message);
    setIsSubmitting(false);
  }
};
```

- [ ] **Step 2: Add imports at the top of `checkout/page.tsx`**

After the existing imports, add:
```typescript
import { loadRazorpaySDK } from "@/lib/razorpay/load-sdk";
import type { RazorpayOptions, RazorpayResponse } from "@/types/razorpay";
```

- [ ] **Step 3: Render the payment error below the Pay Now button**

In the JSX, after the `<p>🔒 Secured by Razorpay</p>` element, add:
```tsx
{paymentError && (
  <p className="text-center text-xs text-red-500 font-inter mt-1">{paymentError}</p>
)}
```

- [ ] **Step 4: Note — `grandTotal` is computed inside render, not accessible in `handleSubmit`**

`grandTotal` is declared at line 174 in the render scope. `handleSubmit` is defined earlier (line 105) in the component, so it closes over `grandTotal` correctly since React re-creates the function on each render. No change needed — this works as-is in the existing component structure.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: All existing tests + new tests PASS. Zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat: integrate Razorpay hosted checkout modal — replace fake setTimeout"
```

---

## Task 5: Update `.env.example`

**Files:**
- Modify: `.env.example`

---

- [ ] **Step 1: Add Razorpay keys to `.env.example`**

Append to `.env.example`:
```
# Razorpay — test key (safe to expose)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
# Razorpay — secret key (SERVER ONLY — never expose to client)
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: document Razorpay env vars in .env.example"
```

---

## Manual Verification Checklist

After completing all tasks, test end-to-end in the browser:

1. Run `npm run dev` and navigate to `/checkout`
2. Fill in the form (or use the pre-filled test values)
3. Click "Pay Now" — verify the Razorpay modal opens (not the fake spinner timeout)
4. Use test card: number `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`
5. Verify the success screen shows a real `order_number` (not `MEI-XXXXXX` format from the old fake flow)
6. Open Supabase dashboard → `orders` table → confirm a new row exists with `status = PENDING`
7. Confirm `order_items` table has matching rows
8. Confirm `customers` table has the customer record

**Dismiss flow:**
- Open modal → click the ✕ / dismiss → verify you're back on checkout form with cart intact and no error shown unless something actually failed before the modal opened

**Error flow:**
- Temporarily set `RAZORPAY_KEY_SECRET=wrong` → click Pay Now → verify a user-facing error message appears (not a crash)
