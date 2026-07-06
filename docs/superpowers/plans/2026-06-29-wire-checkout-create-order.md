# Wire Checkout to create-order Edge Function

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `setTimeout` order in `checkout/page.tsx` with a real call to the `create-order` Supabase Edge Function so that confirmed orders appear in the admin panel.

**Architecture:** The storefront's `handleSubmit` will call a new `createOrder()` service function that invokes the `create-order` Edge Function via `supabase.functions.invoke`. The Edge Function (rewritten to match the current DB schema) inserts a `customers` row, an `orders` row (status `PENDING`), and `order_items` rows, then returns `{ order_id, order_number, total }`. The checkout page shows the real `order_number` in the confirmation screen.

**Tech Stack:** Next.js 15 App Router (client component), Supabase JS (`supabase.functions.invoke`), Deno Edge Functions (TypeScript), Vitest, `@supabase/supabase-js`.

## Global Constraints

- Order status written to DB: `'PENDING'` (UPPERCASE — matches `order_status` enum in `database.ts`)
- Never downgrade `@supabase/supabase-js` — use the version already installed
- Tests use Vitest; mock at the `@supabase/supabase-js` module level (not `@/lib/supabase/client`)
- Edge Function file lives in `mei-admin/supabase/functions/create-order/index.ts` (Deno runtime, no Node imports)
- Storefront env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `shipping_address` has no dedicated column on `orders` — serialise the full address object as JSON into `orders.notes` for now
- No inventory tracking in this plan (the `product_variants` table is not in the storefront's `database.ts`)

---

## Schema reality check (read before touching any code)

The Edge Function at `mei-admin/supabase/functions/create-order/index.ts` was written against an older schema. The actual tables (from `mei/src/lib/supabase/database.ts`) differ:

| Edge Function used      | Actual column in DB          |
|-------------------------|------------------------------|
| `orders.user_id`        | `orders.customer_id`         |
| `orders.total_amount`   | `orders.total`               |
| `orders.order_status`   | `orders.status`              |
| `orders.shipping_address` | *(no column — use `notes`)* |
| `order_items.variant_id` | `order_items.product_id`    |
| `order_items.product_snapshot` | *(no column)*         |
| `product_variants` table | *(not in schema)*           |
| `order_item_measurements` table | *(not in schema)*   |

Task 1 rewrites the function to use the real columns. Tasks 2–4 build on top of that.

---

## File Map

| Action   | Path                                                                 | Responsibility                              |
|----------|----------------------------------------------------------------------|---------------------------------------------|
| Rewrite  | `mei-admin/supabase/functions/create-order/index.ts`                 | Deno Edge Function — DB writes              |
| Create   | `mei/src/lib/services/orders.ts`                                     | Storefront service — wraps functions.invoke |
| Create   | `mei/src/lib/services/__tests__/orders.test.ts`                      | Unit tests for the service                  |
| Modify   | `mei/src/app/checkout/page.tsx`                                      | Replace fake timeout with real service call |

---

### Task 1: Rewrite the create-order Edge Function to match current DB schema

**Files:**
- Rewrite: `mei-admin/supabase/functions/create-order/index.ts`

**Interfaces:**
- Consumes: HTTP POST with JSON body `CreateOrderRequest` (defined below)
- Produces: HTTP 200 JSON `{ order_id: string; order_number: string; total: number }` or HTTP 400 `{ error: string }`

- [ ] **Step 1: Read the current file to understand what will be replaced**

Open `mei-admin/supabase/functions/create-order/index.ts` and note all the mismatched column names listed in the schema table above. You are about to replace the whole file.

- [ ] **Step 2: Write the new Edge Function**

Replace `mei-admin/supabase/functions/create-order/index.ts` entirely with:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface CreateOrderRequest {
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
  };
  items: OrderItem[];
  shipping_address: string;
  shipping_amount: number;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json() as CreateOrderRequest;

    if (!body.customer?.name || !body.customer?.email) {
      return new Response(
        JSON.stringify({ error: 'customer.name and customer.email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!body.items?.length) {
      return new Response(
        JSON.stringify({ error: 'items must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create customer record (one row per order — no dedup required for MVP)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        name: body.customer.name.trim(),
        email: body.customer.email.trim().toLowerCase(),
        phone: body.customer.phone?.trim() || null,
        city: body.customer.city?.trim() || null,
      })
      .select('id')
      .single();

    if (customerError) throw customerError;

    // 2. Compute product total; add shipping
    const productTotal = body.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const total = productTotal + (body.shipping_amount ?? 0);

    // 3. Create order — shipping address stored in notes as JSON
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customer.id,
        status: 'PENDING',
        total,
        notes: body.shipping_address,
      })
      .select('id, order_number')
      .single();

    if (orderError) throw orderError;

    // 4. Insert order_items
    const orderItems = body.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({ order_id: order.id, order_number: order.order_number, total }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-order]', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

- [ ] **Step 3: Verify the function serves locally**

In a terminal (inside `mei-admin/`):
```bash
supabase functions serve create-order --env-file .env.local
```

Expected: `Serving functions on http://localhost:54321/functions/v1/`

Then in a second terminal, smoke-test with curl:
```bash
curl -s -X POST http://localhost:54321/functions/v1/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_ANON_KEY>" \
  -d '{
    "customer": {"name":"Test User","email":"test@test.com","phone":"+91 99999 00000","city":"Mumbai"},
    "items":[{"product_id":"00000000-0000-0000-0000-000000000001","name":"Test Piece","quantity":1,"unit_price":5000}],
    "shipping_address":"{\"addressLine1\":\"123 Test St\",\"city\":\"Mumbai\",\"state\":\"MH\",\"pincode\":\"400001\",\"country\":\"India\"}",
    "shipping_amount":150
  }'
```

Expected response: `{"order_id":"<uuid>","order_number":"<string>","total":5150}` (exact total = 5000 + 150)

- [ ] **Step 4: Commit**

```bash
git add mei-admin/supabase/functions/create-order/index.ts
git commit -m "fix(create-order): align Edge Function to current DB schema (customer_id, status, total)"
```

---

### Task 2: Create the orders service in the storefront

**Files:**
- Create: `mei/src/lib/services/orders.ts`
- Create: `mei/src/lib/services/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: `CreateOrderInput` (defined below)
- Produces: `CreateOrderResult { orderId: string; orderNumber: string; total: number }`

- [ ] **Step 1: Write the failing tests first**

Create `mei/src/lib/services/__tests__/orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createOrder } from "../orders";
import type { CreateOrderInput } from "../orders";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const validInput: CreateOrderInput = {
  customer: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    city: "Mumbai",
  },
  items: [
    { product_id: "prod-1", name: "Bridal Lehenga", quantity: 1, unit_price: 120000 },
  ],
  shipping_address: JSON.stringify({
    addressLine1: "12, Marine Drive",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  }),
  shipping_amount: 0,
};

function makeInvokeClient(result: { data: unknown; error: unknown }) {
  const invoke = vi.fn().mockResolvedValue(result);
  return { functions: { invoke } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("createOrder", () => {
  it("invokes the create-order function with the correct payload", async () => {
    const client = makeInvokeClient({
      data: { order_id: "uuid-1", order_number: "ORD-001", total: 120000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    await createOrder(validInput);

    expect(client.functions.invoke).toHaveBeenCalledWith("create-order", {
      body: validInput,
    });
  });

  it("returns mapped orderId, orderNumber, and total on success", async () => {
    const client = makeInvokeClient({
      data: { order_id: "uuid-1", order_number: "ORD-042", total: 120000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    const result = await createOrder(validInput);

    expect(result).toEqual({ orderId: "uuid-1", orderNumber: "ORD-042", total: 120000 });
  });

  it("throws and logs when invoke returns an error", async () => {
    const invokeError = { message: "Insufficient stock" };
    const client = makeInvokeClient({ data: null, error: invokeError });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toMatchObject({ message: "Insufficient stock" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:createOrder]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("includes shipping_amount in the payload as-is", async () => {
    const client = makeInvokeClient({
      data: { order_id: "uuid-2", order_number: "ORD-043", total: 120150 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    const inputWithShipping = { ...validInput, shipping_amount: 150 };
    await createOrder(inputWithShipping);

    expect(client.functions.invoke).toHaveBeenCalledWith(
      "create-order",
      expect.objectContaining({ body: expect.objectContaining({ shipping_amount: 150 }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mei && npx vitest run src/lib/services/__tests__/orders.test.ts
```

Expected: FAIL — `Cannot find module '../orders'`

- [ ] **Step 3: Create the orders service**

Create `mei/src/lib/services/orders.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export interface CreateOrderInput {
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
  };
  items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
  }>;
  shipping_address: string;
  shipping_amount: number;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = getClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).functions.invoke("create-order", {
    body: input,
  });

  if (error) {
    console.error("[OrdersService:createOrder]", error);
    throw error;
  }

  return {
    orderId: data.order_id,
    orderNumber: data.order_number,
    total: data.total,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mei && npx vitest run src/lib/services/__tests__/orders.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add mei/src/lib/services/orders.ts mei/src/lib/services/__tests__/orders.test.ts
git commit -m "feat(orders): add createOrder service wrapping create-order Edge Function"
```

---

### Task 3: Wire the checkout page to the real service

**Files:**
- Modify: `mei/src/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `createOrder` from `@/lib/services/orders`, `calculateShipping` from `@/lib/config/shipping` (already imported)
- Produces: real `order_number` string shown in the confirmation panel

- [ ] **Step 1: Add the import**

In `mei/src/app/checkout/page.tsx`, add the import for `createOrder` alongside the existing imports (after line 8):

```typescript
import { createOrder } from "@/lib/services/orders";
```

- [ ] **Step 2: Add error state**

After the existing `const [isSubmitting, setIsSubmitting] = useState(false);` (line 64), add:

```typescript
const [orderError, setOrderError] = useState<string | null>(null);
```

- [ ] **Step 3: Replace the fake handleSubmit with the real async version**

Replace the entire `handleSubmit` function (lines 105–118) with:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validate()) return;

  setIsSubmitting(true);
  setOrderError(null);

  try {
    const shippingAmount = calculateShipping(subtotalVal);

    const result = await createOrder({
      customer: {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
      },
      items: items.map((item) => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      })),
      shipping_address: JSON.stringify({
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        country: formData.country.trim(),
      }),
      shipping_amount: shippingAmount,
    });

    clearCart();
    setOrderId(result.orderNumber);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    setOrderError(msg);
  } finally {
    setIsSubmitting(false);
  }
};
```

Note: `subtotalVal` is already computed at line 172 as `const subtotalVal = total();`. Move its definition to before `handleSubmit` so it is accessible inside the function, OR compute it inline in `handleSubmit` using `total()`. The safest approach: compute it inline with `const subtotalVal = total()` inside handleSubmit (remove the one at line 172, or keep it for the summary rendering and re-compute inside the handler too — either works since `total()` is pure).

Practical edit: inside `handleSubmit`, call `calculateShipping(total())` directly:

```typescript
const shippingAmount = calculateShipping(total());
```

- [ ] **Step 4: Add error display in the form UI**

In the Order Summary card, directly above the submit button block (find the `<div className="space-y-3 pt-2">` that wraps the button), add:

```tsx
{orderError && (
  <p className="text-xs text-red-500 font-inter text-center">{orderError}</p>
)}
```

- [ ] **Step 5: Verify the confirmation screen shows the real order number**

The confirmation panel already renders `{orderId}` in:

```tsx
<p className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
  Order Reference: {orderId}
</p>
```

Since we now call `setOrderId(result.orderNumber)`, this will automatically show the DB-generated `order_number`. No change needed here.

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
cd mei && npx vitest run
```

Expected: all tests pass. If any fail, fix before committing.

- [ ] **Step 7: Start the dev server and do a manual checkout flow**

```bash
cd mei && npm run dev
```

1. Navigate to `/shop`, add a product to cart.
2. Go to `/checkout`, fill in the form.
3. Click "Pay Now".
4. Confirm: spinner shows during submission, then confirmation panel shows an `ORD-XXXX` style order number (not `MEI-XXXXXX`).
5. Open the admin panel → Orders → verify a `PENDING` row exists with the correct customer, items, and total.

If the Edge Function is not running locally, start it first:
```bash
cd mei-admin && supabase functions serve create-order --env-file .env.local
```

Expected: order appears in admin with status `PENDING`, total matches what the checkout showed.

- [ ] **Step 8: Commit**

```bash
git add mei/src/app/checkout/page.tsx
git commit -m "feat(checkout): replace fake order timeout with real create-order Edge Function call"
```

---

## Self-Review

### Spec coverage

| Acceptance criterion | Covered by |
|---|---|
| On successful payment, storefront calls create-order with cart + customer + shipping | Task 3 — `handleSubmit` calls `createOrder(...)` |
| An order + order_items row is created; shows in admin as PENDING | Task 1 — Edge Function inserts both rows with `status: 'PENDING'` |
| Order total matches cart total incl. shipping threshold logic | Task 3 — `shipping_amount: calculateShipping(total())` passed to Edge Function; Task 1 — function sums it into `total` |
| Customer sees confirmation with real order number | Task 3 — `setOrderId(result.orderNumber)` |

### Notes on dependencies

- **MEI-31 (env/client):** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present in `.env.local`. The service reads them exactly as the existing client files do.
- **MEI-32 (schema-alignment):** This plan *is* the schema alignment for the Edge Function. We rewrote the function to match the real schema in `database.ts`. If MEI-32 changes the DB schema further (e.g. adds a dedicated `shipping_address` column), update `orders.ts` insert to use it instead of `notes`.
- **MEI-20 (Razorpay):** This plan calls `createOrder` directly on form submit. When Razorpay is added, move the `createOrder` call into the Razorpay payment success callback (`handler` function) and remove the current direct call. The `CreateOrderInput` interface will remain unchanged.
