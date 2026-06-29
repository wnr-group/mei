# Production-Grade Checkout → create-order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `setTimeout` checkout with a production-safe flow: Razorpay payment → server-side HMAC signature verification in the Edge Function → transactional order creation via Postgres RPC → real order number in the existing confirmation screen.

**Architecture:** The checkout page loads Razorpay via CDN script tag, calls a Next.js API route (`/api/razorpay/create-order`) to get a server-computed order amount and Razorpay order ID, opens the modal, then passes payment credentials to `createOrder()` which invokes the `create-order` Edge Function. The Edge Function verifies the Razorpay HMAC signature, delegates all DB writes to a single Postgres RPC function (`create_order_txn`) that runs customer upsert + order + order_items atomically with idempotency on `payment_id`. Server recomputes the total from DB prices — client prices are ignored. A dev bypass mode skips Razorpay entirely.

**Tech Stack:** Next.js 16 API routes, Razorpay CDN checkout (no npm package), Node.js built-in `Buffer` / `fetch`, Supabase Edge Functions (Deno / Web Crypto), Postgres `plpgsql`, `@supabase/supabase-js`, Vitest.

## Global Constraints

- No new npm packages — use Node.js built-in `crypto`/`Buffer` and Razorpay CDN only
- No UI changes — preserve all CSS classes, layout, form fields, and the confirmation screen exactly
- No changes to any passing test files — only add new ones
- `orders.status` must remain `'PENDING'` (UPPERCASE) on creation
- The Edge Function is the **only** code path that writes to `orders`, `order_items`, or `customers`
- `ENABLE_PAYMENT_BYPASS=true` in Edge Function env bypasses Razorpay verification in local dev; MUST be `false` in production
- `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true` in storefront `.env.local` skips the Razorpay modal in dev
- Shipping constants: `FREE_SHIPPING_THRESHOLD = 5000`, `SHIPPING_FLAT_RATE = 150` — same values as `src/lib/config/shipping.ts`; hardcoded identically in the RPC
- Migration filename: `011_checkout_production.sql` (next after `010_banners_deleted_at.sql`)
- Edge Function import: `jsr:@supabase/supabase-js@2` (Deno JSR registry)

---

## Schema Context (read before writing any code)

**Current `orders` table** (from migration `003_customers_orders.sql`):
```
id, order_number (#ORD-9000 format), customer_id, status, total, notes, created_at, updated_at
```

**This plan adds** (via migration `011`):
```
payment_id TEXT UNIQUE, payment_provider TEXT, payment_metadata JSONB, shipping_address JSONB
```

**`customers.email`** already has a `UNIQUE` constraint (migration `003`) — `ON CONFLICT (email)` works out of the box.

**Old Edge Function** used `product_variants`, `order_item_measurements`, `user_id`, `total_amount`, `order_status` — none of these exist. Task 2 rewrites it for the actual schema.

---

## File Map

| Action   | Path                                                                        | Responsibility                                                   |
|----------|-----------------------------------------------------------------------------|------------------------------------------------------------------|
| Create   | `mei-admin/supabase/migrations/011_checkout_production.sql`                 | Add payment columns to `orders`; create `create_order_txn` RPC   |
| Modify   | `mei/src/lib/supabase/database.ts`                                          | Add new columns to TypeScript order types                        |
| Rewrite  | `mei-admin/supabase/functions/create-order/index.ts`                        | Verify HMAC → call RPC → structured `{ success, ... }` response  |
| Create   | `mei/src/app/api/razorpay/create-order/route.ts`                            | Server-side Razorpay order creation with server-computed amount   |
| Create   | `mei/src/lib/services/orders.ts`                                            | `createOrder()` — wraps `functions.invoke` with correlation ID   |
| Create   | `mei/src/lib/services/__tests__/orders.test.ts`                             | Unit tests for the service                                       |
| Modify   | `mei/src/app/checkout/page.tsx`                                             | Razorpay modal + bypass mode; remove fake timeout                |

---

### Task 1: DB Migration — Payment Columns + Transactional RPC

**Files:**
- Create: `mei-admin/supabase/migrations/011_checkout_production.sql`
- Modify: `mei/src/lib/supabase/database.ts`

**Interfaces:**
- Produces: Postgres function `create_order_txn(p_customer jsonb, p_items jsonb, p_shipping_address jsonb, p_payment_id text, p_payment_provider text, p_payment_metadata jsonb) → jsonb`
- Return shape: `{ order_id uuid, order_number text, total numeric, already_exists bool }`

- [ ] **Step 1: Create the migration file**

Create `mei-admin/supabase/migrations/011_checkout_production.sql`:

```sql
-- ── Payment columns on orders ───────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_metadata JSONB,
  ADD COLUMN IF NOT EXISTS shipping_address JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_payment_id
  ON public.orders (payment_id)
  WHERE payment_id IS NOT NULL;

-- ── Transactional order-creation RPC ────────────────────────────────────────
-- SECURITY DEFINER: runs as the function owner, bypassing RLS.
-- SET search_path: prevents search_path injection.
CREATE OR REPLACE FUNCTION public.create_order_txn(
  p_customer         jsonb,
  p_items            jsonb,
  p_shipping_address jsonb,
  p_payment_id       text,
  p_payment_provider text    DEFAULT 'razorpay',
  p_payment_metadata jsonb   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id  uuid;
  v_order_id     uuid;
  v_order_number text;
  v_subtotal     numeric(12,2) := 0;
  v_shipping     numeric(12,2);
  v_total        numeric(12,2);
  v_item         jsonb;
  v_price        numeric(12,2);
  v_existing     record;
BEGIN
  -- Idempotency: if this payment_id was already processed, return the existing order
  SELECT id, order_number, total
  INTO v_existing
  FROM orders
  WHERE payment_id = p_payment_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id',       v_existing.id,
      'order_number',   v_existing.order_number,
      'total',          v_existing.total,
      'already_exists', true
    );
  END IF;

  -- Upsert customer by email (customers.email is UNIQUE from migration 003)
  INSERT INTO customers (name, email, phone, city)
  VALUES (
    trim(p_customer->>'name'),
    lower(trim(p_customer->>'email')),
    nullif(trim(p_customer->>'phone'), ''),
    nullif(trim(p_customer->>'city'),  '')
  )
  ON CONFLICT (email) DO UPDATE
    SET name  = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        city  = COALESCE(EXCLUDED.city,  customers.city)
  RETURNING id INTO v_customer_id;

  -- Server-side subtotal: fetch actual product prices from DB — never trust the client
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_price
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      -- Colon separator so callers can parse the product_id from the message
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_item->>'product_id';
    END IF;

    v_subtotal := v_subtotal + v_price * (v_item->>'quantity')::integer;
  END LOOP;

  -- Shipping threshold — mirrors src/lib/config/shipping.ts exactly
  v_shipping := CASE WHEN v_subtotal >= 5000 THEN 0 ELSE 150 END;
  v_total    := v_subtotal + v_shipping;

  -- Create order
  INSERT INTO orders (
    customer_id, status, total,
    payment_id, payment_provider, payment_metadata, shipping_address
  )
  VALUES (
    v_customer_id,
    'PENDING',
    v_total,
    p_payment_id,
    p_payment_provider,
    p_payment_metadata,
    p_shipping_address
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- Insert order items using DB prices (not client-supplied unit_price)
  INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    item->>'name',
    (item->>'quantity')::integer,
    p.price
  FROM jsonb_array_elements(p_items) AS item
  JOIN products p ON p.id = (item->>'product_id')::uuid;

  RETURN jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total',          v_total,
    'already_exists', false
  );
END;
$$;
```

- [ ] **Step 2: Apply the migration**

In `mei-admin/`:
```bash
supabase migration up
```

Expected: migration applied with no errors.

Verify with:
```bash
supabase db diff
```

Expected: empty diff.

- [ ] **Step 3: Update database.ts — add payment columns to orders types**

Open `mei/src/lib/supabase/database.ts`. Find the `orders` block and replace it with:

```typescript
orders: {
  Row: {
    id: string;
    order_number: string;
    customer_id: string | null;
    status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    total: number;
    notes: string | null;
    payment_id: string | null;
    payment_provider: string | null;
    payment_metadata: Json | null;
    shipping_address: Json | null;
    created_at: string;
    updated_at: string;
  }
  Insert: {
    id?: string;
    order_number?: string;
    customer_id?: string | null;
    status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    total: number;
    notes?: string | null;
    payment_id?: string | null;
    payment_provider?: string | null;
    payment_metadata?: Json | null;
    shipping_address?: Json | null;
  }
  Update: {
    status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    total?: number;
    notes?: string | null;
    payment_id?: string | null;
    payment_provider?: string | null;
    payment_metadata?: Json | null;
    shipping_address?: Json | null;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add mei-admin/supabase/migrations/011_checkout_production.sql mei/src/lib/supabase/database.ts
git commit -m "feat(db): add payment columns to orders; add create_order_txn RPC with idempotency"
```

---

### Task 2: Rewrite the create-order Edge Function

**Files:**
- Rewrite: `mei-admin/supabase/functions/create-order/index.ts`

**Interfaces:**
- Consumes: `POST { customer, items, shipping_address, payment: { provider, payment_id, order_id, signature } }` + optional header `x-request-id`
- Produces: `{ success: true, order_id, order_number, total }` or `{ success: false, error: 'ERROR_CODE' }`
- Edge Function env vars required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `ENABLE_PAYMENT_BYPASS`

- [ ] **Step 1: Rewrite the Edge Function**

Replace the entire contents of `mei-admin/supabase/functions/create-order/index.ts` with:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id',
};

function jsonResponse(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

async function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${razorpayOrderId}|${razorpayPaymentId}`)
  );
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signature;
}

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
}

interface PaymentInfo {
  provider: string;
  payment_id: string;
  order_id: string;
  signature: string;
}

interface CreateOrderRequest {
  customer: { name: string; email: string; phone: string; city: string };
  items: OrderItem[];
  shipping_address: Record<string, string>;
  payment: PaymentInfo;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const log = (msg: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ requestId, msg, ...(data ?? {}) }));

  log('create-order started');

  try {
    const body = (await req.json()) as CreateOrderRequest;

    if (!body.customer?.email || !body.items?.length || !body.payment?.payment_id) {
      log('invalid payload');
      return jsonResponse({ success: false, error: 'INVALID_PAYLOAD' }, 400);
    }

    const bypass = Deno.env.get('ENABLE_PAYMENT_BYPASS') === 'true';

    if (!bypass) {
      const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
      if (!secret) {
        log('RAZORPAY_KEY_SECRET not configured');
        return jsonResponse({ success: false, error: 'SERVER_MISCONFIGURED' }, 500);
      }
      const valid = await verifyRazorpaySignature(
        body.payment.order_id,
        body.payment.payment_id,
        body.payment.signature,
        secret
      );
      if (!valid) {
        log('HMAC verification failed', { payment_id: body.payment.payment_id });
        return jsonResponse({ success: false, error: 'PAYMENT_VERIFICATION_FAILED' }, 400);
      }
      log('HMAC verified', { payment_id: body.payment.payment_id });
    } else {
      log('bypass mode — signature verification skipped');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase.rpc('create_order_txn', {
      p_customer: body.customer,
      p_items: body.items,
      p_shipping_address: body.shipping_address,
      p_payment_id: body.payment.payment_id,
      p_payment_provider: body.payment.provider,
      p_payment_metadata: {
        razorpay_order_id: body.payment.order_id,
        razorpay_signature: body.payment.signature,
        request_id: requestId,
      },
    });

    if (error) {
      log('RPC error', { message: error.message });
      if (error.message?.includes('PRODUCT_NOT_FOUND')) {
        return jsonResponse({ success: false, error: 'PRODUCT_NOT_FOUND' }, 400);
      }
      return jsonResponse({ success: false, error: 'ORDER_CREATION_FAILED' }, 500);
    }

    log('order created', {
      order_id: String(data.order_id),
      already_exists: String(data.already_exists),
    });

    return jsonResponse(
      {
        success: true,
        order_id: data.order_id,
        order_number: data.order_number,
        total: data.total,
      },
      200,
      { 'x-request-id': requestId }
    );
  } catch (err) {
    log('unhandled error', { message: String(err) });
    return jsonResponse({ success: false, error: 'INTERNAL_ERROR' }, 500);
  }
});
```

- [ ] **Step 2: Add Edge Function env vars**

Create or update `mei-admin/.env.local`:
```env
ENABLE_PAYMENT_BYPASS=true
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
```

(The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by `supabase functions serve`.)

- [ ] **Step 3: Smoke-test the function with bypass enabled**

```bash
cd mei-admin
supabase functions serve create-order --env-file .env.local
```

In a second terminal, substitute a real product UUID from your local DB:

```bash
curl -s -X POST http://localhost:54321/functions/v1/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_ANON_KEY>" \
  -H "x-request-id: smoke-test-001" \
  -d '{
    "customer": {"name":"Test User","email":"test@mei.test","phone":"+91 9999900000","city":"Mumbai"},
    "items": [{"product_id":"<REAL_PRODUCT_UUID>","name":"Test Piece","quantity":1}],
    "shipping_address": {"addressLine1":"123 Test St","city":"Mumbai","state":"MH","pincode":"400001","country":"India"},
    "payment": {"provider":"bypass","payment_id":"pay-smoke-001","order_id":"bypass","signature":"bypass"}
  }'
```

Expected: `{"success":true,"order_id":"<uuid>","order_number":"#ORD-9000","total":150}`

Run the same curl again (same `payment_id`). Expected: same `order_id` returned — idempotency working.

- [ ] **Step 4: Commit**

```bash
git add mei-admin/supabase/functions/create-order/index.ts mei-admin/.env.local
git commit -m "feat(create-order): production Edge Function — HMAC verification, idempotency via RPC, correlation IDs"
```

Note: if `.env.local` is in `.gitignore`, add only the function file.

---

### Task 3: Razorpay Order Creation API Route

**Files:**
- Create: `mei/src/app/api/razorpay/create-order/route.ts`

**Interfaces:**
- Consumes: `POST { items: Array<{ product_id: string; quantity: number }> }`
- Produces (production): `{ razorpay_order_id: string; amount: number; currency: "INR"; key_id: string }`
- Produces (bypass): `{ razorpay_order_id: "bypass_<uuid>"; amount: number; currency: "INR"; key_id: "bypass"; bypass: true }`
- Required env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS`

- [ ] **Step 1: Create the route**

Create `mei/src/app/api/razorpay/create-order/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: Array<{ product_id: string; quantity: number }> = body.items ?? [];

    if (!items.length) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
    }

    // Server-side price lookup — client prices are never trusted
    const { data: products, error } = await anonClient()
      .from("products")
      .select("id, price")
      .in("id", items.map((i) => i.product_id));

    if (error || !products) {
      console.error("[razorpay/create-order] product lookup failed", error);
      return NextResponse.json({ error: "PRODUCT_LOOKUP_FAILED" }, { status: 500 });
    }

    const priceMap = Object.fromEntries(products.map((p) => [p.id, p.price as number]));

    let subtotal = 0;
    for (const item of items) {
      const price = priceMap[item.product_id];
      if (price == null) {
        return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 400 });
      }
      subtotal += price * item.quantity;
    }

    // Shipping threshold — mirrors src/lib/config/shipping.ts
    const shipping = subtotal >= 5000 ? 0 : 150;
    const total = subtotal + shipping;
    const amountPaise = Math.round(total * 100);

    // Bypass mode: return a fake Razorpay order for local development
    if (process.env.NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS === "true") {
      return NextResponse.json({
        razorpay_order_id: `bypass_${crypto.randomUUID()}`,
        amount: amountPaise,
        currency: "INR",
        key_id: "bypass",
        bypass: true,
      });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const razorRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
      }),
    });

    if (!razorRes.ok) {
      const errText = await razorRes.text();
      console.error("[razorpay/create-order] Razorpay API error", errText);
      return NextResponse.json({ error: "RAZORPAY_ORDER_FAILED" }, { status: 502 });
    }

    const razorOrder = await razorRes.json();

    return NextResponse.json({
      razorpay_order_id: razorOrder.id,
      amount: razorOrder.amount,
      currency: razorOrder.currency,
      key_id: keyId,
    });
  } catch (err) {
    console.error("[razorpay/create-order] unhandled", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add storefront env vars**

Add to `mei/.env.local`:
```env
# Razorpay (get from Razorpay dashboard → Settings → API Keys)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_KEY_SECRET=your_secret_here

# Set "true" for local dev; MUST be "false" or absent in production
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true
```

- [ ] **Step 3: Smoke-test the route in bypass mode**

Start the dev server and run:
```bash
curl -s -X POST http://localhost:3000/api/razorpay/create-order \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product_id":"<REAL_PRODUCT_UUID>","quantity":1}]}'
```

Expected: `{"razorpay_order_id":"bypass_<uuid>","amount":<number in paise>,"currency":"INR","key_id":"bypass","bypass":true}`

The `amount` in paise for a ₹150 shipping-only result = `15000`.

- [ ] **Step 4: Commit**

```bash
git add mei/src/app/api/razorpay/create-order/route.ts
git commit -m "feat(api): razorpay/create-order route with server-side price verification and bypass mode"
```

---

### Task 4: Orders Service + Unit Tests

**Files:**
- Create: `mei/src/lib/services/orders.ts`
- Create: `mei/src/lib/services/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: `CreateOrderInput` (defined in this task)
- Produces: `CreateOrderResult { orderId: string; orderNumber: string; total: number }`

- [ ] **Step 1: Write the failing tests**

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
  items: [{ product_id: "prod-uuid-1", name: "Bridal Lehenga", quantity: 1 }],
  shipping_address: {
    addressLine1: "12 Marine Drive",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  },
  payment: {
    provider: "razorpay",
    payment_id: "pay_test_001",
    order_id: "order_test_001",
    signature: "sig_test_001",
  },
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
  it("invokes create-order with the full input as body and an x-request-id header", async () => {
    const client = makeInvokeClient({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9000", total: 120000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    await createOrder(validInput);

    expect(client.functions.invoke).toHaveBeenCalledWith(
      "create-order",
      expect.objectContaining({
        body: validInput,
        headers: expect.objectContaining({ "x-request-id": expect.any(String) }),
      })
    );
  });

  it("returns mapped orderId, orderNumber, and total on success", async () => {
    const client = makeInvokeClient({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9042", total: 120000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    const result = await createOrder(validInput);

    expect(result).toEqual({
      orderId: "uuid-1",
      orderNumber: "#ORD-9042",
      total: 120000,
    });
  });

  it("throws and logs when invoke returns a transport-level error", async () => {
    const client = makeInvokeClient({ data: null, error: { message: "Network error" } });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toMatchObject({ message: "Network error" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:createOrder]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("throws with the error code when Edge Function returns success:false", async () => {
    const client = makeInvokeClient({
      data: { success: false, error: "PAYMENT_VERIFICATION_FAILED" },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toThrow("PAYMENT_VERIFICATION_FAILED");
    spy.mockRestore();
  });

  it("generates a unique x-request-id for each call", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9000", total: 5000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      { functions: { invoke } } as unknown as ReturnType<typeof createClient>
    );

    await createOrder(validInput);
    await createOrder(validInput);

    const id1 = invoke.mock.calls[0][1].headers["x-request-id"];
    const id2 = invoke.mock.calls[1][1].headers["x-request-id"];
    expect(id1).not.toBe(id2);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd mei && npx vitest run src/lib/services/__tests__/orders.test.ts
```

Expected: FAIL — `Cannot find module '../orders'`

- [ ] **Step 3: Implement the service**

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
  }>;
  shipping_address: Record<string, string>;
  payment: {
    provider: string;
    payment_id: string;
    order_id: string;
    signature: string;
  };
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
  const requestId = crypto.randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).functions.invoke("create-order", {
    body: input,
    headers: { "x-request-id": requestId },
  });

  if (error) {
    console.error("[OrdersService:createOrder]", error);
    throw error;
  }

  if (!data?.success) {
    const msg = data?.error ?? "ORDER_CREATION_FAILED";
    console.error("[OrdersService:createOrder]", msg);
    throw new Error(msg);
  }

  return {
    orderId: data.order_id,
    orderNumber: data.order_number,
    total: data.total,
  };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd mei && npx vitest run src/lib/services/__tests__/orders.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Run the full test suite to catch regressions**

```bash
cd mei && npx vitest run
```

Expected: all pre-existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add mei/src/lib/services/orders.ts mei/src/lib/services/__tests__/orders.test.ts
git commit -m "feat(orders): createOrder service with correlation IDs and structured error handling"
```

---

### Task 5: Wire the Checkout Page

**Files:**
- Modify: `mei/src/app/checkout/page.tsx`

**Interfaces:**
- Consumes: `createOrder` from `@/lib/services/orders` (Task 4)
- Consumes: `/api/razorpay/create-order` (Task 3)
- Preserves: **all** existing JSX, CSS classes, form fields, confirmation screen, and submit button text

- [ ] **Step 1: Add the createOrder import**

In `mei/src/app/checkout/page.tsx`, add one line after the existing imports (after line 8):

```typescript
import { createOrder } from "@/lib/services/orders";
```

- [ ] **Step 2: Add error state**

Immediately after `const [isSubmitting, setIsSubmitting] = useState(false);` (line 64), add:

```typescript
const [orderError, setOrderError] = useState<string | null>(null);
```

- [ ] **Step 3: Load Razorpay script**

After the existing `useEffect` that calls `setMounted(true)` (lines 66–69), add a second `useEffect`:

```typescript
useEffect(() => {
  const script = document.createElement("script");
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.async = true;
  document.body.appendChild(script);
  return () => {
    document.body.removeChild(script);
  };
}, []);
```

- [ ] **Step 4: Replace handleSubmit**

Replace the entire `handleSubmit` function (currently lines 105–118) with the following. Note: `subtotalVal` is defined at line 172 in the original file and is used in the JSX below handleSubmit — leave that usage in place; compute `shipping` inline in the handler for bypass mode totals:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validate()) return;

  setIsSubmitting(true);
  setOrderError(null);

  const sharedPayload = {
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
    })),
    shipping_address: {
      addressLine1: formData.addressLine1.trim(),
      addressLine2: formData.addressLine2.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      pincode: formData.pincode.trim(),
      country: formData.country.trim(),
    },
  };

  const bypass = process.env.NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS === "true";

  if (bypass) {
    // Dev bypass: skip Razorpay, call Edge Function directly with fake payment
    try {
      const result = await createOrder({
        ...sharedPayload,
        payment: {
          provider: "bypass",
          payment_id: crypto.randomUUID(),
          order_id: "bypass",
          signature: "bypass",
        },
      });
      clearCart();
      setOrderId(result.orderNumber);
    } catch (err) {
      setOrderError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
    return;
  }

  // Production: create Razorpay order server-side, open modal, confirm on payment
  try {
    const rzpOrderRes = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      }),
    });

    if (!rzpOrderRes.ok) {
      throw new Error("Failed to initialize payment. Please try again.");
    }

    const { razorpay_order_id, amount, currency, key_id } =
      (await rzpOrderRes.json()) as {
        razorpay_order_id: string;
        amount: number;
        currency: string;
        key_id: string;
      };

    type RzpConstructor = new (options: Record<string, unknown>) => { open(): void };
    const Razorpay = (window as Record<string, unknown>).Razorpay as RzpConstructor;

    const rzp = new Razorpay({
      key: key_id,
      amount,
      currency,
      name: "MEI Atelier",
      description: "Handcrafted Bridal Wear",
      order_id: razorpay_order_id,
      prefill: {
        name: formData.name,
        email: formData.email,
        contact: formData.phone,
      },
      theme: { color: "#c9a465" },
      modal: {
        ondismiss: () => setIsSubmitting(false),
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const result = await createOrder({
            ...sharedPayload,
            payment: {
              provider: "razorpay",
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              signature: response.razorpay_signature,
            },
          });
          clearCart();
          setOrderId(result.orderNumber);
        } catch (err) {
          const payId = response.razorpay_payment_id;
          setOrderError(
            err instanceof Error
              ? `${err.message} (Payment ID: ${payId})`
              : `Order creation failed. Contact support with Payment ID: ${payId}`
          );
        } finally {
          setIsSubmitting(false);
        }
      },
    });

    rzp.open();
  } catch (err) {
    setOrderError(
      err instanceof Error ? err.message : "Something went wrong. Please try again."
    );
    setIsSubmitting(false);
  }
};
```

- [ ] **Step 5: Add error display**

Find the `<div className="space-y-3 pt-2">` block that wraps the submit `<button>` inside the Order Summary card. Insert this **immediately before** that `<div>` (just above the submit button wrapper):

```tsx
{orderError && (
  <p className="text-xs text-red-500 font-inter text-center px-2">{orderError}</p>
)}
```

- [ ] **Step 6: Confirm the confirmation screen is already correct**

The existing confirmation JSX at lines 128–170 renders:

```tsx
<p className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
  Order Reference: {orderId}
</p>
```

`setOrderId(result.orderNumber)` now populates this with the real DB `order_number` (format `#ORD-9000`). **No JSX change needed.**

- [ ] **Step 7: Run the full test suite**

```bash
cd mei && npx vitest run
```

Expected: all tests pass (including all existing tests). Fix any failures before continuing.

- [ ] **Step 8: End-to-end manual test (bypass mode)**

Ensure both servers are running:
```bash
# Terminal 1 (Edge Function):
cd mei-admin && supabase functions serve create-order --env-file .env.local

# Terminal 2 (Next.js):
cd mei && npm run dev
```

Manual flow:
1. `http://localhost:3000/shop` → add a product to cart
2. `http://localhost:3000/checkout` → fill all form fields
3. Click **"Pay Now — ₹X,XXX"**
4. Confirm: spinner shows, then confirmation screen appears with **"Order Reference: #ORD-XXXX"** (not a fake `MEI-XXXXXX`)
5. Open admin panel → Orders list → verify a `PENDING` row exists with correct customer, product, and total
6. Attempt a second submit with the same browser session after refreshing (cart will be empty, button disabled — this is the expected guard)

- [ ] **Step 9: Commit**

```bash
git add mei/src/app/checkout/page.tsx
git commit -m "feat(checkout): Razorpay payment flow with bypass mode; real order number in confirmation"
```

---

## Self-Review

### Spec coverage

| Requirement | Task that covers it |
|---|---|
| 1. Edge Function as single source of truth — no direct DB writes | Task 4: `functions.invoke` only; zero `from('orders')` in storefront |
| 2. Razorpay HMAC signature verification | Task 2: `verifyRazorpaySignature()` using Web Crypto |
| 3. Idempotency on `payment_id` | Task 1: `UNIQUE` column + RPC early-return on duplicate `payment_id` |
| 4. DB transaction semantics | Task 1: `create_order_txn` is a single PG function — runs atomically |
| 5. Customer upsert by email | Task 1: `ON CONFLICT (email) DO UPDATE` |
| 6. Server-side total — never trust client | Task 1 RPC: queries `products.price`; Task 3 API route: queries DB before creating Razorpay order |
| 7. Shipping threshold preserved | Task 1: `CASE WHEN v_subtotal >= 5000 THEN 0 ELSE 150`; Task 3: same formula |
| 8. Order status stays `PENDING` | Task 1: hardcoded `'PENDING'` in RPC INSERT |
| 9. Structured error responses `{ success, error }` | Task 2: every Edge Function path returns `{ success: false, error: 'CODE' }` |
| 10. Correlation IDs throughout | Task 4: `crypto.randomUUID()` → `x-request-id` header; Task 2: logged + stored in `payment_metadata.request_id` |
| 11. Inventory hooks only if schema exists | `product_variants` is not in `database.ts` — no inventory code added |
| 12. Confirmation screen unchanged | Task 5 Step 6: confirmed no JSX changes needed |
| 13. Stable API surface `{ order_id, order_number, total }` | Task 2: Edge Function response; Task 4: service exposes `{ orderId, orderNumber, total }` |
| 14. `ENABLE_PAYMENT_BYPASS` flag | Task 2: Edge Function reads Deno env; Task 3: API route reads `process.env`; Task 5: checkout reads `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS` |

### Production checklist

Before deploying, set these production values:
```
# In Supabase Edge Function secrets:
ENABLE_PAYMENT_BYPASS=false      # CRITICAL — must be false
RAZORPAY_KEY_SECRET=rzp_live_... # Production secret

# In storefront hosting env:
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false  # or unset
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=rzp_live_...
```
