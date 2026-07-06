# MEI-20 Razorpay Integration — Production Grade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `setTimeout` mock payment in the MEI storefront checkout with a fully-verified Razorpay hosted modal, backed by server-side order creation in `mei-admin`.

**Architecture:** The `mei-admin` Next.js app owns all order creation, payment verification, and webhook reconciliation. The `mei` storefront has thin Next.js API proxy routes that forward to `mei-admin` with a shared secret (`STOREFRONT_API_SECRET`). The Razorpay modal is loaded lazily in the browser only when the customer clicks "Pay Now". All Razorpay secrets live exclusively in `mei-admin`.

**Tech Stack:** Razorpay Node.js SDK (`razorpay` npm package), Node.js `crypto` for HMAC/timingSafeEqual, Next.js 16 App Router API Routes, Supabase JS service client, Vitest.

---

## Two-Repo Scope

This plan modifies **both** sibling repos:
- `C:\Users\Eshwar\WNR\mei` — storefront (proxy routes, checkout page, payment loader)
- `C:\Users\Eshwar\WNR\mei-admin` — backend (Razorpay service, order creation, webhook)

Tasks are prefixed **[mei]** or **[mei-admin]** to make the active repo clear. Always be in the correct directory before running commands.

---

## Global Constraints

- ADDITIVE ONLY: Create new files only. Never rename/delete/move existing files.
- Do NOT modify: Header, Footer, Search, WhatsApp, Product pages, Cart, Shipping calculations, GST, Checkout form fields/validation/styling/responsiveness.
- `mei` storefront must NEVER insert directly into `orders` or `order_items` tables.
- Secrets (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) must NEVER appear in browser-accessible code or API responses.
- After EVERY task: run `npm run lint && npx tsc --noEmit && npm test` in the affected repo. If a previously-passing test fails, STOP and fix before continuing.
- Commit after every task using the pattern `feat(payment): <description>`.
- Next.js version: 16.2.6, React 19, Vitest 4.

---

## File Map

**Created in `mei-admin`:**
- `lib/services/razorpay.ts` — SDK wrapper: `createRazorpayOrder`, `fetchPayment`, `verifyPaymentSignature`, `verifyWebhookSignature`
- `lib/services/payment-orders.ts` — `lookupProductPrices`, `computeTotal`, `createOrderWithPayment`
- `app/api/payments/razorpay-order/route.ts` — `POST`: creates Razorpay order, returns `razorpay_order_id`
- `app/api/payments/complete-order/route.ts` — `POST`: verifies HMAC + amount, creates order in DB
- `app/api/payments/webhook/route.ts` — `POST`: Razorpay webhook, HMAC-verified, reconciles orders
- `__tests__/services/razorpay.test.ts`
- `__tests__/services/payment-orders.test.ts`
- `__tests__/api/payments/razorpay-order.test.ts`
- `__tests__/api/payments/complete-order.test.ts`
- `__tests__/api/payments/webhook.test.ts`

**Modified in `mei-admin`:**
- `types/database.ts` — Add payment columns to `orders` Row/Insert/Update types

**Created in `mei`:**
- `src/lib/payments/loader.ts` — Lazily loads `checkout.js`, defines `RazorpayCheckoutOptions` and `RazorpayPaymentResponse` types
- `src/lib/payments/checkout.ts` — Opens Razorpay modal, returns `Promise<RazorpayPaymentResponse>`
- `src/app/api/payments/create-razorpay-order/route.ts` — Proxy to `mei-admin /api/payments/razorpay-order`
- `src/app/api/payments/verify/route.ts` — Proxy to `mei-admin /api/payments/complete-order`
- `src/lib/payments/__tests__/loader.test.ts`
- `src/app/api/payments/__tests__/create-razorpay-order.test.ts`
- `src/app/api/payments/__tests__/verify.test.ts`

**Modified in `mei`:**
- `src/lib/supabase/database.ts` — Add payment columns to `orders` Row/Insert/Update types
- `src/app/checkout/page.tsx` — Replace `setTimeout` mock with real Razorpay flow (surgical: ~15 lines replaced, 2 lines added)
- `.env.example` — Add `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `MEI_ADMIN_API_URL`, `STOREFRONT_API_SECRET`

**Database migration (run in Supabase dashboard — not a file in either repo):**
- SQL adds 7 payment columns to `orders` table + 2 indexes

---

## Task 1: Baseline Verification

**Files:** No changes.

**Interfaces:**
- Produces: recorded baseline pass/fail counts to compare after each task.

- [ ] **Step 1: Record [mei] baseline**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint
npx tsc --noEmit
npm test
```

Save the test count (N passing, M failing) to memory or a scratch file. Do NOT commit.

- [ ] **Step 2: Record [mei-admin] baseline**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint
npx tsc --noEmit
npm run test:run
```

Save the test count similarly.

---

## Task 2: Database Migration + Type Updates

**Files:**
- No file created — SQL run in Supabase dashboard
- Modify: `C:\Users\Eshwar\WNR\mei\src\lib\supabase\database.ts`
- Modify: `C:\Users\Eshwar\WNR\mei-admin\types\database.ts`

**Interfaces:**
- Produces: `orders.razorpay_order_id`, `orders.razorpay_payment_id`, `orders.payment_method`, `orders.payment_status`, `orders.payment_captured_at`, `orders.webhook_verified`, `orders.reconciliation_status` available in Supabase types for all subsequent tasks.

- [ ] **Step 1: Run migration in Supabase SQL Editor**

Go to Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id      TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id     TEXT,
  ADD COLUMN IF NOT EXISTS payment_method          TEXT,
  ADD COLUMN IF NOT EXISTS payment_status          TEXT,
  ADD COLUMN IF NOT EXISTS payment_captured_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reconciliation_status   TEXT;

CREATE INDEX IF NOT EXISTS orders_razorpay_order_id_idx
  ON orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_payment_id_uniq
  ON orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
```

Expected output: "Success. No rows returned."

- [ ] **Step 2: Update `mei/src/lib/supabase/database.ts` — orders table**

Find the `orders:` block. The current `Row` ends at `updated_at: string }`. Replace the entire `orders:` block with:

```typescript
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string; razorpay_order_id: string | null; razorpay_payment_id: string | null; payment_method: string | null; payment_status: string | null; payment_captured_at: string | null; webhook_verified: boolean; reconciliation_status: string | null }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
      }
```

- [ ] **Step 3: Update `mei-admin/types/database.ts` — orders table**

Find the `orders:` block. The `mei-admin` version already has `deleted_at` in Row and Update — keep it. Replace only the `orders:` block with:

```typescript
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null; razorpay_order_id: string | null; razorpay_payment_id: string | null; payment_method: string | null; payment_status: string | null; payment_captured_at: string | null; webhook_verified: boolean; reconciliation_status: string | null }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null; deleted_at?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
      }
```

- [ ] **Step 4: Verify both compile**

```
cd C:\Users\Eshwar\WNR\mei && npx tsc --noEmit
cd C:\Users\Eshwar\WNR\mei-admin && npx tsc --noEmit
```

Expected: zero errors in both.

- [ ] **Step 5: Commit both**

```
cd C:\Users\Eshwar\WNR\mei
git add src/lib/supabase/database.ts
git commit -m "feat(payment): add Razorpay payment columns to orders DB type"

cd C:\Users\Eshwar\WNR\mei-admin
git add types/database.ts
git commit -m "feat(payment): add Razorpay payment columns to orders DB type"
```

---

## Task 3: Razorpay SDK + Service Wrapper [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\lib\services\razorpay.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\razorpay.test.ts`

**Interfaces:**
- Produces:
  - `createRazorpayOrder({ amount_paise: number, currency: 'INR', receipt: string }): Promise<{ razorpay_order_id: string; amount: number; currency: string }>`
  - `RazorpayPayment = { id: string; amount: number; status: string; method: string; order_id: string }`
  - `fetchPayment(paymentId: string): Promise<RazorpayPayment>`
  - `verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }): boolean` — uses `timingSafeEqual`
  - `verifyWebhookSignature(rawBody: string, signature: string): boolean` — uses `timingSafeEqual`

- [ ] **Step 1: Install Razorpay SDK**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm install razorpay
```

Expected: `razorpay` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\razorpay.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: {
      create: vi.fn().mockResolvedValue({ id: 'order_test123', amount: 100000, currency: 'INR' }),
    },
    payments: {
      fetch: vi.fn().mockResolvedValue({ id: 'pay_test456', amount: 100000, status: 'captured', method: 'upi', order_id: 'order_test123' }),
    },
  })),
}))

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
  process.env.RAZORPAY_KEY_SECRET = 'test_secret_abc'
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_xyz'
  vi.resetModules()
})

describe('createRazorpayOrder', () => {
  it('returns razorpay_order_id from SDK', async () => {
    const { createRazorpayOrder } = await import('@/lib/services/razorpay')
    const result = await createRazorpayOrder({ amount_paise: 100000, currency: 'INR', receipt: 'rcpt_1' })
    expect(result.razorpay_order_id).toBe('order_test123')
    expect(result.amount).toBe(100000)
  })
})

describe('fetchPayment', () => {
  it('returns payment object', async () => {
    const { fetchPayment } = await import('@/lib/services/razorpay')
    const payment = await fetchPayment('pay_test456')
    expect(payment.status).toBe('captured')
    expect(payment.amount).toBe(100000)
    expect(payment.method).toBe('upi')
  })
})

describe('verifyPaymentSignature', () => {
  it('returns true for correct HMAC', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    const orderId = 'order_test123'
    const paymentId = 'pay_test456'
    const sig = createHmac('sha256', 'test_secret_abc').update(`${orderId}|${paymentId}`).digest('hex')
    expect(verifyPaymentSignature({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig })).toBe(true)
  })

  it('returns false for tampered signature', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    expect(verifyPaymentSignature({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test456', razorpay_signature: 'deadbeef' })).toBe(false)
  })

  it('returns false for non-hex or wrong-length signature', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    expect(verifyPaymentSignature({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test456', razorpay_signature: 'short' })).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  it('returns true for valid webhook HMAC', async () => {
    const { verifyWebhookSignature } = await import('@/lib/services/razorpay')
    const body = '{"event":"payment.captured"}'
    const sig = createHmac('sha256', 'webhook_secret_xyz').update(body).digest('hex')
    expect(verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('returns false for invalid webhook signature', async () => {
    const { verifyWebhookSignature } = await import('@/lib/services/razorpay')
    expect(verifyWebhookSignature('{"event":"payment.captured"}', 'badsig')).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/services/razorpay.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/services/razorpay'"

- [ ] **Step 4: Create `lib/services/razorpay.ts`**

```typescript
import Razorpay from 'razorpay'
import { createHmac, timingSafeEqual } from 'crypto'

let _instance: Razorpay | null = null

function getInstance(): Razorpay {
  if (!_instance) {
    _instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return _instance
}

export async function createRazorpayOrder(params: {
  amount_paise: number
  currency: 'INR'
  receipt: string
}): Promise<{ razorpay_order_id: string; amount: number; currency: string }> {
  const order = await getInstance().orders.create({
    amount: params.amount_paise,
    currency: params.currency,
    receipt: params.receipt,
  })
  return {
    razorpay_order_id: order.id,
    amount: typeof order.amount === 'string' ? parseInt(order.amount, 10) : order.amount,
    currency: order.currency,
  }
}

export type RazorpayPayment = {
  id: string
  amount: number
  status: string
  method: string
  order_id: string
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const p = await getInstance().payments.fetch(paymentId)
  return {
    id: p.id,
    amount: typeof p.amount === 'string' ? parseInt(p.amount, 10) : (p.amount as number),
    status: p.status as string,
    method: p.method as string,
    order_id: (p as unknown as { order_id: string }).order_id,
  }
}

export function verifyPaymentSignature(params: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}): boolean {
  const body = `${params.razorpay_order_id}|${params.razorpay_payment_id}`
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex')
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(params.razorpay_signature, 'hex')
    )
  } catch {
    return false
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/services/razorpay.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Full check**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
```

Expected: lint clean, zero type errors, all prior tests still pass.

- [ ] **Step 7: Commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
git add lib/services/razorpay.ts __tests__/services/razorpay.test.ts package.json package-lock.json
git commit -m "feat(payment): add Razorpay SDK wrapper with timingSafeEqual HMAC verification"
```

---

## Task 4: Payment Order Service [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\lib\services\payment-orders.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\payment-orders.test.ts`

**Interfaces:**
- Consumes: `Database` from `@/types/database` (with payment columns from Task 2), `@supabase/supabase-js`
- Produces:
  - `CartItemInput = { product_id: string; quantity: number }`
  - `CustomerInput = { name, email, phone, city, address_line1, address_line2?, state, pincode, country }`
  - `FREE_SHIPPING_THRESHOLD = 5000`, `SHIPPING_FLAT_RATE = 150`
  - `lookupProductPrices(items: CartItemInput[]): Promise<Map<string, { name: string; price: number }>>`
  - `computeTotal(items, priceMap): { subtotal: number; shipping: number; total: number }`
  - `createOrderWithPayment(params): Promise<{ order_id: string; order_number: string }>`

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\payment-orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockIs = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_key'
  vi.resetModules()
})

describe('computeTotal', () => {
  it('returns subtotal + flat shipping when below threshold', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['p1', { name: 'Lehenga', price: 3000 }]])
    const result = computeTotal([{ product_id: 'p1', quantity: 1 }], priceMap)
    expect(result.subtotal).toBe(3000)
    expect(result.shipping).toBe(150)
    expect(result.total).toBe(3150)
  })

  it('returns free shipping when subtotal >= 5000', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['p1', { name: 'Saree', price: 6000 }]])
    const result = computeTotal([{ product_id: 'p1', quantity: 1 }], priceMap)
    expect(result.shipping).toBe(0)
    expect(result.total).toBe(6000)
  })

  it('throws if a product_id is missing from priceMap', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map<string, { name: string; price: number }>()
    expect(() => computeTotal([{ product_id: 'missing', quantity: 1 }], priceMap)).toThrow('Product missing not found')
  })

  it('multiplies quantity correctly across multiple items', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([
      ['p1', { name: 'A', price: 2000 }],
      ['p2', { name: 'B', price: 1500 }],
    ])
    const result = computeTotal([{ product_id: 'p1', quantity: 2 }, { product_id: 'p2', quantity: 1 }], priceMap)
    expect(result.subtotal).toBe(5500)
    expect(result.shipping).toBe(0)
  })
})

describe('lookupProductPrices', () => {
  it('returns a Map of product_id to name+price', async () => {
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockReturnValue({
          eq: mockEq.mockReturnValue({
            is: mockIs.mockResolvedValue({
              data: [{ id: 'p1', name: 'Lehenga', price: 3000 }],
              error: null,
            }),
          }),
        }),
      }),
    })
    const { lookupProductPrices } = await import('@/lib/services/payment-orders')
    const result = await lookupProductPrices([{ product_id: 'p1', quantity: 1 }])
    expect(result.get('p1')).toEqual({ name: 'Lehenga', price: 3000 })
  })

  it('throws on Supabase error', async () => {
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockReturnValue({
          eq: mockEq.mockReturnValue({
            is: mockIs.mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })
    const { lookupProductPrices } = await import('@/lib/services/payment-orders')
    await expect(lookupProductPrices([{ product_id: 'p1', quantity: 1 }])).rejects.toThrow('Failed to look up product prices')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/services/payment-orders.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/services/payment-orders.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const FREE_SHIPPING_THRESHOLD = 5000
export const SHIPPING_FLAT_RATE = 150

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type CartItemInput = { product_id: string; quantity: number }

export type CustomerInput = {
  name: string
  email: string
  phone: string
  city: string
  address_line1: string
  address_line2?: string
  state: string
  pincode: string
  country: string
}

type ProductLookup = { id: string; name: string; price: number }

export async function lookupProductPrices(
  cartItems: CartItemInput[]
): Promise<Map<string, { name: string; price: number }>> {
  const supabase = getServiceClient()
  const ids = cartItems.map((i) => i.product_id)
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', ids)
    .eq('status', 'PUBLISHED')
    .is('deleted_at', null) as { data: ProductLookup[] | null; error: { message: string } | null }

  if (error || !data) throw new Error('Failed to look up product prices')

  const map = new Map<string, { name: string; price: number }>()
  for (const p of data) map.set(p.id, { name: p.name, price: p.price })
  return map
}

export function computeTotal(
  cartItems: CartItemInput[],
  priceMap: Map<string, { name: string; price: number }>
): { subtotal: number; shipping: number; total: number } {
  const subtotal = cartItems.reduce((sum, item) => {
    const product = priceMap.get(item.product_id)
    if (!product) throw new Error(`Product ${item.product_id} not found or not available`)
    return sum + product.price * item.quantity
  }, 0)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE
  return { subtotal, shipping, total: subtotal + shipping }
}

export async function createOrderWithPayment(params: {
  customer: CustomerInput
  cartItems: CartItemInput[]
  priceMap: Map<string, { name: string; price: number }>
  razorpayOrderId: string
  razorpayPaymentId: string
  paymentMethod: string
  totalINR: number
}): Promise<{ order_id: string; order_number: string }> {
  const supabase = getServiceClient()
  const { customer, cartItems, priceMap, razorpayOrderId, razorpayPaymentId, paymentMethod, totalINR } = params

  const { data: customerRow, error: customerError } = await supabase
    .from('customers')
    .insert({ name: customer.name, email: customer.email, phone: customer.phone, city: customer.city })
    .select('id')
    .single()
  if (customerError || !customerRow) throw new Error('Failed to create customer')

  const notes = JSON.stringify({
    shipping: {
      line1: customer.address_line1,
      line2: customer.address_line2 ?? null,
      state: customer.state,
      pincode: customer.pincode,
      country: customer.country,
    },
  })

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: customerRow.id,
      total: totalINR,
      status: 'CONFIRMED',
      notes,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      payment_method: paymentMethod,
      payment_status: 'captured',
      payment_captured_at: new Date().toISOString(),
      webhook_verified: false,
    })
    .select('id, order_number')
    .single()
  if (orderError || !order) throw new Error('Failed to create order')

  const orderItems = cartItems.map((item) => {
    const product = priceMap.get(item.product_id)!
    return {
      order_id: order.id,
      product_id: item.product_id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
    }
  })
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
  if (itemsError) throw new Error('Failed to create order items')

  return { order_id: order.id, order_number: order.order_number }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/services/payment-orders.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Full check**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
```

Expected: clean.

- [ ] **Step 6: Commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
git add lib/services/payment-orders.ts __tests__/services/payment-orders.test.ts
git commit -m "feat(payment): add payment order creation service with price validation"
```

---

## Task 5: Create Razorpay Order API [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\app\api\payments\razorpay-order\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\razorpay-order.test.ts`

**Interfaces:**
- Consumes: `createRazorpayOrder` from `@/lib/services/razorpay`; `lookupProductPrices`, `computeTotal`, `CartItemInput` from `@/lib/services/payment-orders`
- Produces: `POST /api/payments/razorpay-order`
  - Auth: `Authorization: Bearer <STOREFRONT_API_SECRET>`
  - Request body: `{ cart_items: CartItemInput[], currency: 'INR' }`
  - Response 200: `{ razorpay_order_id: string, amount_paise: number, currency: 'INR' }`
  - Response 401: unauthorized
  - Response 400: validation error

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\razorpay-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services/razorpay', () => ({
  createRazorpayOrder: vi.fn().mockResolvedValue({ razorpay_order_id: 'order_abc', amount: 315000, currency: 'INR' }),
}))

vi.mock('@/lib/services/payment-orders', () => ({
  lookupProductPrices: vi.fn().mockResolvedValue(new Map([['p1', { name: 'Lehenga', price: 3000 }]])),
  computeTotal: vi.fn().mockReturnValue({ subtotal: 3000, shipping: 150, total: 3150 }),
}))

function makeRequest(body: unknown, secret = 'test_secret') {
  return new NextRequest('http://localhost/api/payments/razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.STOREFRONT_API_SECRET = 'test_secret'
  vi.resetModules()
})

describe('POST /api/payments/razorpay-order', () => {
  it('returns razorpay_order_id for valid request', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    const res = await POST(makeRequest({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.razorpay_order_id).toBe('order_abc')
    expect(data.amount_paise).toBe(315000)
  })

  it('returns 401 when Authorization header is absent', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    const req = new NextRequest('http://localhost/api/payments/razorpay-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }),
    })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 401 when secret is wrong', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeRequest({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }, 'wrong'))).status).toBe(401)
  })

  it('returns 400 for non-INR currency', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeRequest({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'USD' }))).status).toBe(400)
  })

  it('returns 400 for empty cart_items', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeRequest({ cart_items: [], currency: 'INR' }))).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/razorpay-order.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/payments/razorpay-order/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createRazorpayOrder } from '@/lib/services/razorpay'
import { lookupProductPrices, computeTotal, type CartItemInput } from '@/lib/services/payment-orders'

function verifyStorefrontAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.STOREFRONT_API_SECRET ?? ''}`
  if (auth.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(auth))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!verifyStorefrontAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { cart_items: CartItemInput[]; currency: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { cart_items, currency } = body
  if (!Array.isArray(cart_items) || cart_items.length === 0) {
    return NextResponse.json({ error: 'cart_items required' }, { status: 400 })
  }
  if (currency !== 'INR') {
    return NextResponse.json({ error: 'Only INR supported' }, { status: 400 })
  }

  try {
    const priceMap = await lookupProductPrices(cart_items)
    const { total } = computeTotal(cart_items, priceMap)
    const amount_paise = Math.round(total * 100)
    const order = await createRazorpayOrder({ amount_paise, currency: 'INR', receipt: `rcpt_${Date.now()}` })
    return NextResponse.json({ razorpay_order_id: order.razorpay_order_id, amount_paise, currency: 'INR' })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/razorpay-order.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Full check and commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add app/api/payments/razorpay-order/route.ts __tests__/api/payments/razorpay-order.test.ts
git commit -m "feat(payment): add create-razorpay-order API endpoint"
```

---

## Task 6: Complete Order API [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\app\api\payments\complete-order\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\complete-order.test.ts`

**Interfaces:**
- Consumes: `verifyPaymentSignature`, `fetchPayment` from `@/lib/services/razorpay`; `lookupProductPrices`, `computeTotal`, `createOrderWithPayment`, `CustomerInput`, `CartItemInput` from `@/lib/services/payment-orders`
- Produces: `POST /api/payments/complete-order`
  - Auth: `Authorization: Bearer <STOREFRONT_API_SECRET>`
  - Request: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, customer: CustomerInput, cart_items: CartItemInput[], currency: 'INR' }`
  - Response 200: `{ order_number: string }`
  - Response 400: invalid signature / not captured / amount mismatch / validation
  - Response 502: Razorpay API unreachable

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\complete-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyPaymentSignature = vi.fn()
const mockFetchPayment = vi.fn()
const mockLookupProductPrices = vi.fn()
const mockComputeTotal = vi.fn()
const mockCreateOrderWithPayment = vi.fn()

vi.mock('@/lib/services/razorpay', () => ({
  verifyPaymentSignature: mockVerifyPaymentSignature,
  fetchPayment: mockFetchPayment,
}))

vi.mock('@/lib/services/payment-orders', () => ({
  lookupProductPrices: mockLookupProductPrices,
  computeTotal: mockComputeTotal,
  createOrderWithPayment: mockCreateOrderWithPayment,
}))

const validCustomer = {
  name: 'Priya', email: 'priya@test.com', phone: '+91 99999 00000',
  city: 'Mumbai', address_line1: '123 MG Road', state: 'Maharashtra',
  pincode: '400001', country: 'India',
}

const validBody = {
  razorpay_order_id: 'order_abc',
  razorpay_payment_id: 'pay_xyz',
  razorpay_signature: 'valid_sig',
  customer: validCustomer,
  cart_items: [{ product_id: 'p1', quantity: 1 }],
  currency: 'INR',
}

function makeRequest(body: unknown, secret = 'test_secret') {
  return new NextRequest('http://localhost/api/payments/complete-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STOREFRONT_API_SECRET = 'test_secret'
  mockVerifyPaymentSignature.mockReturnValue(true)
  mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 315000, status: 'captured', method: 'upi', order_id: 'order_abc' })
  mockLookupProductPrices.mockResolvedValue(new Map([['p1', { name: 'Lehenga', price: 3000 }]]))
  mockComputeTotal.mockReturnValue({ subtotal: 3000, shipping: 150, total: 3150 })
  mockCreateOrderWithPayment.mockResolvedValue({ order_id: 'uuid-123', order_number: 'MEI-100001' })
  vi.resetModules()
})

describe('POST /api/payments/complete-order', () => {
  it('returns order_number on success', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect((await res.json()).order_number).toBe('MEI-100001')
  })

  it('returns 401 without Authorization', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const req = new NextRequest('http://localhost/api/payments/complete-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 400 when signature is invalid', async () => {
    mockVerifyPaymentSignature.mockReturnValue(false)
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/signature/i)
  })

  it('returns 400 when payment status is not captured', async () => {
    mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 315000, status: 'failed', method: 'upi', order_id: 'order_abc' })
    const { POST } = await import('@/app/api/payments/complete-order/route')
    expect((await POST(makeRequest(validBody))).status).toBe(400)
  })

  it('returns 400 when payment amount does not match', async () => {
    mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 100000, status: 'captured', method: 'upi', order_id: 'order_abc' })
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/amount/i)
  })

  it('returns 400 for non-INR currency', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    expect((await POST(makeRequest({ ...validBody, currency: 'USD' }))).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/complete-order.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/payments/complete-order/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { verifyPaymentSignature, fetchPayment } from '@/lib/services/razorpay'
import {
  lookupProductPrices,
  computeTotal,
  createOrderWithPayment,
  type CustomerInput,
  type CartItemInput,
} from '@/lib/services/payment-orders'

function verifyStorefrontAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.STOREFRONT_API_SECRET ?? ''}`
  if (auth.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(auth))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!verifyStorefrontAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
    customer: CustomerInput
    cart_items: CartItemInput[]
    currency: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer, cart_items, currency } = body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }
  if (!customer?.name || !customer?.email) {
    return NextResponse.json({ error: 'Missing customer fields' }, { status: 400 })
  }
  if (!Array.isArray(cart_items) || cart_items.length === 0) {
    return NextResponse.json({ error: 'cart_items required' }, { status: 400 })
  }
  if (currency !== 'INR') {
    return NextResponse.json({ error: 'Only INR supported' }, { status: 400 })
  }

  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  let payment: Awaited<ReturnType<typeof fetchPayment>>
  try {
    payment = await fetchPayment(razorpay_payment_id)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch payment from Razorpay' }, { status: 502 })
  }

  if (payment.status !== 'captured') {
    return NextResponse.json({ error: `Payment not captured: ${payment.status}` }, { status: 400 })
  }

  let priceMap: Map<string, { name: string; price: number }>
  try {
    priceMap = await lookupProductPrices(cart_items)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Product lookup failed' }, { status: 400 })
  }

  const { total: totalINR } = computeTotal(cart_items, priceMap)
  const expectedPaise = Math.round(totalINR * 100)

  if (payment.amount !== expectedPaise) {
    return NextResponse.json({ error: `Amount mismatch: expected ${expectedPaise}, got ${payment.amount}` }, { status: 400 })
  }

  try {
    const result = await createOrderWithPayment({
      customer,
      cartItems: cart_items,
      priceMap,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentMethod: payment.method,
      totalINR,
    })
    return NextResponse.json({ order_number: result.order_number })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create order' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/complete-order.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Full check and commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add app/api/payments/complete-order/route.ts __tests__/api/payments/complete-order.test.ts
git commit -m "feat(payment): add complete-order API with HMAC + amount validation"
```

---

## Task 7: Webhook Handler [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\app\api\payments\webhook\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\webhook.test.ts`

**Interfaces:**
- Consumes: `verifyWebhookSignature` from `@/lib/services/razorpay`; Supabase service client
- Produces: `POST /api/payments/webhook`
  - Auth: `x-razorpay-signature` header (Razorpay HMAC, NOT the storefront secret)
  - Handles events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`
  - Idempotency: skips `payment.captured` update if `webhook_verified = true` already
  - Returns 200 always after signature check (to prevent Razorpay retries on order lookup misses)

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyWebhookSignature = vi.fn()
const mockMaybeSingle = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/services/razorpay', () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

function makeRequest(body: unknown, sig = 'valid_sig') {
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_key'
  mockVerifyWebhookSignature.mockReturnValue(true)
  mockMaybeSingle.mockResolvedValue({ data: { id: 'order-uuid', webhook_verified: false }, error: null })
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  vi.resetModules()
})

describe('POST /api/payments/webhook', () => {
  it('returns 400 for invalid signature', async () => {
    mockVerifyWebhookSignature.mockReturnValue(false)
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeRequest({ event: 'payment.captured' }, 'badsig'))).status).toBe(400)
  })

  it('returns 200 with received:true for payment.captured', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'order_rzp', method: 'upi' } } } }
    const res = await POST(makeRequest(payload))
    expect(res.status).toBe(200)
    expect((await res.json()).received).toBe(true)
  })

  it('returns 200 for payment.failed', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.failed', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'order_rzp' } } } }
    expect((await POST(makeRequest(payload))).status).toBe(200)
  })

  it('skips DB update when order already webhook_verified (idempotency)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'order-uuid', webhook_verified: true }, error: null })
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'order_rzp', method: 'upi' } } } }
    const res = await POST(makeRequest(payload))
    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 for unknown event types (do not block Razorpay)', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeRequest({ event: 'order.paid', payload: {} }))).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/webhook.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/payments/webhook/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature } from '@/lib/services/razorpay'
import type { Database } from '@/types/database'

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type PaymentEntity = { id?: string; order_id?: string; method?: string }
type RefundEntity = { id?: string; payment_id?: string }
type WebhookPayload = {
  payment?: { entity?: PaymentEntity }
  refund?: { entity?: RefundEntity }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event: string; payload: WebhookPayload }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getServiceClient()

  switch (event.event) {
    case 'payment.captured': {
      const payment = event.payload.payment?.entity
      if (!payment?.order_id) break
      const { data: existing } = await supabase
        .from('orders')
        .select('id, webhook_verified')
        .eq('razorpay_order_id', payment.order_id)
        .maybeSingle()
      if (existing?.webhook_verified) break
      await supabase
        .from('orders')
        .update({
          payment_status: 'captured',
          webhook_verified: true,
          razorpay_payment_id: payment.id ?? null,
          payment_method: payment.method ?? null,
          payment_captured_at: new Date().toISOString(),
        })
        .eq('razorpay_order_id', payment.order_id)
      break
    }
    case 'payment.failed': {
      const payment = event.payload.payment?.entity
      if (!payment?.order_id) break
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', webhook_verified: true })
        .eq('razorpay_order_id', payment.order_id)
      break
    }
    case 'refund.created': {
      const refund = event.payload.refund?.entity
      if (!refund?.payment_id) break
      await supabase
        .from('orders')
        .update({ reconciliation_status: 'refund_initiated' })
        .eq('razorpay_payment_id', refund.payment_id)
      break
    }
    case 'refund.processed': {
      const refund = event.payload.refund?.entity
      if (!refund?.payment_id) break
      await supabase
        .from('orders')
        .update({ reconciliation_status: 'refund_processed' })
        .eq('razorpay_payment_id', refund.payment_id)
      break
    }
    default:
      console.log(`[webhook] Unhandled event: ${event.event}`)
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/webhook.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Full check and commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add app/api/payments/webhook/route.ts __tests__/api/payments/webhook.test.ts
git commit -m "feat(payment): add webhook handler with HMAC verification and idempotency"
```

---

## Task 8: Storefront Payment Client Layer [mei]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei\src\lib\payments\loader.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\lib\payments\checkout.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\create-razorpay-order\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\verify\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\lib\payments\__tests__\loader.test.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\create-razorpay-order.test.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\verify.test.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_RAZORPAY_KEY_ID` env var (browser), `MEI_ADMIN_API_URL` env var (server), `STOREFRONT_API_SECRET` env var (server)
- Produces:
  - `RazorpayPaymentResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }`
  - `openRazorpayCheckout(options): Promise<RazorpayPaymentResponse>` — lazily loads checkout.js, opens modal
  - `POST /api/payments/create-razorpay-order` → proxies to `mei-admin`
  - `POST /api/payments/verify` → proxies to `mei-admin`

- [ ] **Step 1: Write the failing loader test**

Create `C:\Users\Eshwar\WNR\mei\src\lib\payments\__tests__\loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { loadRazorpayScript } from '../loader'

describe('loadRazorpayScript', () => {
  it('rejects immediately when called outside a browser (node env)', async () => {
    // vitest runs in node; window is undefined
    await expect(loadRazorpayScript()).rejects.toThrow('Not in browser')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```
cd C:\Users\Eshwar\WNR\mei
npm test -- src/lib/payments/__tests__/loader.test.ts
```

Expected: FAIL — "Cannot find module '../loader'"

- [ ] **Step 3: Create `src/lib/payments/loader.ts`**

```typescript
export type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  handler: (response: RazorpayPaymentResponse) => void
  modal?: { ondismiss?: () => void }
}

export type RazorpayPaymentResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayInstance = {
  open: () => void
  on: (event: string, callback: (response: unknown) => void) => void
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

export function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not in browser'))
      return
    }
    if (window.Razorpay) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay script'))
    document.body.appendChild(script)
  })
}
```

- [ ] **Step 4: Run to verify loader test passes**

```
cd C:\Users\Eshwar\WNR\mei
npm test -- src/lib/payments/__tests__/loader.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 5: Create `src/lib/payments/checkout.ts`**

```typescript
import { loadRazorpayScript, type RazorpayPaymentResponse } from './loader'

export async function openRazorpayCheckout(options: {
  razorpay_order_id: string
  amount_paise: number
  currency: 'INR'
  customer_name: string
  customer_email: string
  customer_phone: string
}): Promise<RazorpayPaymentResponse> {
  await loadRazorpayScript()

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      amount: options.amount_paise,
      currency: options.currency,
      name: 'MEI Bridal Couture',
      description: 'Handcrafted Bridal Wear',
      order_id: options.razorpay_order_id,
      prefill: {
        name: options.customer_name,
        email: options.customer_email,
        contact: options.customer_phone,
      },
      theme: { color: '#c9a465' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled by user')),
      },
    })
    rzp.on('payment.failed', (response: unknown) => reject(response))
    rzp.open()
  })
}
```

- [ ] **Step 6: Write the failing proxy route tests**

Create `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\create-razorpay-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MEI_ADMIN_API_URL = 'http://localhost:3001'
  process.env.STOREFRONT_API_SECRET = 'test_secret'
  vi.resetModules()
})

describe('POST /api/payments/create-razorpay-order', () => {
  it('proxies to mei-admin and returns the response', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ razorpay_order_id: 'order_abc', amount_paise: 315000, currency: 'INR' }),
      status: 200,
    })
    const { POST } = await import('../create-razorpay-order/route')
    const req = new NextRequest('http://localhost/api/payments/create-razorpay-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_items: [{ product_id: 'p1', quantity: 1 }] }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.razorpay_order_id).toBe('order_abc')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/payments/razorpay-order',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Authorization': 'Bearer test_secret' }),
      })
    )
  })

  it('returns 503 when MEI_ADMIN_API_URL is not set', async () => {
    delete process.env.MEI_ADMIN_API_URL
    const { POST } = await import('../create-razorpay-order/route')
    const req = new NextRequest('http://localhost/api/payments/create-razorpay-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_items: [] }),
    })
    expect((await POST(req)).status).toBe(503)
  })
})
```

Create `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\verify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MEI_ADMIN_API_URL = 'http://localhost:3001'
  process.env.STOREFRONT_API_SECRET = 'test_secret'
  vi.resetModules()
})

describe('POST /api/payments/verify', () => {
  it('proxies to mei-admin and returns order_number', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ order_number: 'MEI-100001' }),
      status: 200,
    })
    const { POST } = await import('../verify/route')
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id: 'order_abc', razorpay_payment_id: 'pay_xyz', razorpay_signature: 'sig' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect((await res.json()).order_number).toBe('MEI-100001')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/payments/complete-order',
      expect.objectContaining({ headers: expect.objectContaining({ 'Authorization': 'Bearer test_secret' }) })
    )
  })

  it('returns 503 when MEI_ADMIN_API_URL is not set', async () => {
    delete process.env.MEI_ADMIN_API_URL
    const { POST } = await import('../verify/route')
    const req = new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect((await POST(req)).status).toBe(503)
  })
})
```

- [ ] **Step 7: Run proxy tests to verify they fail**

```
cd C:\Users\Eshwar\WNR\mei
npm test -- src/app/api/payments/__tests__/
```

Expected: FAIL — modules not found.

- [ ] **Step 8: Create `src/app/api/payments/create-razorpay-order/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const adminUrl = process.env.MEI_ADMIN_API_URL
  if (!adminUrl) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const response = await fetch(`${adminUrl}/api/payments/razorpay-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.STOREFRONT_API_SECRET}`,
    },
    body: JSON.stringify({ ...(body as object), currency: 'INR' }),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
```

- [ ] **Step 9: Create `src/app/api/payments/verify/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const adminUrl = process.env.MEI_ADMIN_API_URL
  if (!adminUrl) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const response = await fetch(`${adminUrl}/api/payments/complete-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.STOREFRONT_API_SECRET}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
```

- [ ] **Step 10: Run all new tests to verify they pass**

```
cd C:\Users\Eshwar\WNR\mei
npm test -- src/lib/payments/__tests__/ src/app/api/payments/__tests__/
```

Expected: all 5 tests PASS.

- [ ] **Step 11: Full check and commit**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
git add src/lib/payments/ src/app/api/payments/
git commit -m "feat(payment): add Razorpay loader, checkout helper, and proxy API routes"
```

---

## Task 9: Checkout Page Integration + Environment Variables [mei]

**Files:**
- Modify: `C:\Users\Eshwar\WNR\mei\src\app\checkout\page.tsx`
- Modify: `C:\Users\Eshwar\WNR\mei\.env.example`
- Modify: `C:\Users\Eshwar\WNR\mei-admin\.env.example`

**CRITICAL — What changes vs. what stays:**

| Stays UNCHANGED | Changes |
|---|---|
| All JSX, styles, Tailwind classes | `handleSubmit` body (the `setTimeout` block) |
| Form fields, validation logic | `handleSubmit` signature → add `async` |
| `calculateShipping`, `formatCurrency` | Add `paymentError` state variable |
| Success view (`if (orderId) { return ... }`) | Add one `<p>` for error display |
| Submit button text, spinner | Nothing else |
| Cart logic, clearing on success | |

- [ ] **Step 1: Read the current checkout page**

Open and read `src/app/checkout/page.tsx`. Confirm the file matches what was analyzed during planning (the `handleSubmit` function at ~line 105 uses `setTimeout`).

- [ ] **Step 2: Add `paymentError` state**

Find this existing line (around line 64):
```typescript
  const [isSubmitting, setIsSubmitting] = useState(false);
```

Add this line immediately after it:
```typescript
  const [paymentError, setPaymentError] = useState<string | null>(null);
```

- [ ] **Step 3: Replace the `handleSubmit` function**

Find and replace the entire `handleSubmit` function. The current function (to remove) is:

```typescript
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      const mockOrderId = "MEI-" + Math.floor(100000 + Math.random() * 900000);
      clearCart();
      setOrderId(mockOrderId);
    }, 1800);
  };
```

Replace it with:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setPaymentError(null);

    try {
      const cartItems = items.map((i) => ({ product_id: i.id, quantity: i.quantity }));

      const orderRes = await fetch("/api/payments/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_items: cartItems }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error ?? "Failed to initiate payment");

      const { openRazorpayCheckout } = await import("@/lib/payments/checkout");
      const payment = await openRazorpayCheckout({
        razorpay_order_id: orderData.razorpay_order_id,
        amount_paise: orderData.amount_paise,
        currency: "INR",
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
      });

      const verifyRes = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature,
          customer: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            city: formData.city,
            address_line1: formData.addressLine1,
            address_line2: formData.addressLine2,
            state: formData.state,
            pincode: formData.pincode,
            country: formData.country,
          },
          cart_items: cartItems,
          currency: "INR",
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");

      clearCart();
      setOrderId(verifyData.order_number);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed. Please try again.";
      if (message !== "Payment cancelled by user") {
        setPaymentError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 4: Add the payment error display**

Find this existing element:
```tsx
              <p className="text-center text-xs uppercase tracking-widest text-[#9a9a9a] font-bold select-none">
                🔒 Secured by Razorpay
              </p>
```

Add this block immediately above it (between the `</button>` closing tag and the "Secured by Razorpay" paragraph):

```tsx
              {paymentError && (
                <p className="text-xs text-red-500 text-center font-inter">{paymentError}</p>
              )}
```

- [ ] **Step 5: Update `mei/.env.example`**

Append to the end of `C:\Users\Eshwar\WNR\mei\.env.example`:

```
# Razorpay — public key only (safe for browser)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id_here

# mei-admin base URL (server-side only, never NEXT_PUBLIC)
MEI_ADMIN_API_URL=http://localhost:3001

# Shared secret between mei and mei-admin (server-side only, generate with: openssl rand -hex 32)
STOREFRONT_API_SECRET=replace_with_secure_random_string
```

- [ ] **Step 6: Update `mei-admin/.env.example`**

Append to the end of `C:\Users\Eshwar\WNR\mei-admin\.env.example`:

```
# Razorpay — all keys server-side only, NEVER use NEXT_PUBLIC prefix
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard

# Shared secret for requests from mei storefront (generate with: openssl rand -hex 32)
STOREFRONT_API_SECRET=replace_with_secure_random_string
```

- [ ] **Step 7: Run full check**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
```

Expected: lint clean, zero type errors, all prior tests still pass (same count as Task 1 baseline plus the new tests added in Task 8).

- [ ] **Step 8: Commit**

```
cd C:\Users\Eshwar\WNR\mei
git add src/app/checkout/page.tsx .env.example
git commit -m "feat(payment): integrate Razorpay hosted modal into checkout flow"

cd C:\Users\Eshwar\WNR\mei-admin
git add .env.example
git commit -m "feat(payment): document Razorpay and STOREFRONT_API_SECRET env vars"
```

---

## Task 10: Post-Implementation Verification

**Files:** None.

- [ ] **Step 1: Final test suite [mei]**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
```

Expected: same or more tests passing than Task 1 baseline, zero new failures.

- [ ] **Step 2: Final test suite [mei-admin]**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
```

Expected: same or more tests passing than Task 1 baseline, zero new failures.

- [ ] **Step 3: Security scan (grep)**

Run each and verify zero hits for the dangerous patterns:

```
grep -r "NEXT_PUBLIC_RAZORPAY_KEY_SECRET" C:\Users\Eshwar\WNR\mei\src
grep -r "NEXT_PUBLIC_RAZORPAY_WEBHOOK" C:\Users\Eshwar\WNR\mei\src
grep -r "key_secret" C:\Users\Eshwar\WNR\mei\src
grep -r "key_secret" C:\Users\Eshwar\WNR\mei-admin\app\api
```

Expected: all return zero matches.

- [ ] **Step 4: Razorpay dashboard configuration (manual)**

1. Razorpay Test Dashboard → Settings → API Keys → Generate Test Key  
   - Copy Key ID → `NEXT_PUBLIC_RAZORPAY_KEY_ID` (in `mei`) and `RAZORPAY_KEY_ID` (in `mei-admin`)  
   - Copy Key Secret → `RAZORPAY_KEY_SECRET` (in `mei-admin` only)

2. Razorpay Test Dashboard → Settings → Webhooks → Add Webhook URL:  
   `https://<your-mei-admin-domain>/api/payments/webhook`  
   Subscribe events: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`  
   - Copy webhook secret → `RAZORPAY_WEBHOOK_SECRET` (in `mei-admin`)

3. Generate shared secret: run `openssl rand -hex 32` → paste same value as `STOREFRONT_API_SECRET` in BOTH `mei` and `mei-admin`.

4. Set `MEI_ADMIN_API_URL` in `mei` to the URL where `mei-admin` is running (e.g., `http://localhost:3001` in dev).

- [ ] **Step 5: End-to-end smoke test (manual in browser)**

Start both dev servers (`mei` on 3000, `mei-admin` on 3001). Then:

**Happy path:**
1. Add a product to cart. Navigate to `/checkout`. Fill all form fields. Click "Pay Now".
2. Razorpay modal opens. Use test card: `4111 1111 1111 1111`, expiry `12/26`, CVV `123`.
3. Payment completes → checkout page shows the success view with a real `order_number` (format `MEI-XXXXXX`).
4. Navigate to `mei-admin` `/orders` → new order visible with status CONFIRMED and payment fields populated.

**Cancellation path:**
1. Add product, go to checkout, click "Pay Now", then close the Razorpay modal (X button).
2. Page stays on checkout form. Cart still intact. No error message shown (cancellation is silent).

**Failure path:**
1. Add product, go to checkout, click "Pay Now". Use declined test card `4000 0000 0000 0002`.
2. Razorpay shows failure. Page returns to checkout form. Red error message appears below the Pay Now button. Cart still intact.

---

## Spec Coverage Summary

| Requirement | Where Implemented |
|---|---|
| Hosted checkout modal | Task 9 (`openRazorpayCheckout` dynamically imported) |
| Server-side HMAC verification | Tasks 5 (`verifyStorefrontAuth`), 6 (`verifyPaymentSignature`), 7 (`verifyWebhookSignature`) |
| Live payment verification | Task 6 (`fetchPayment` → check `status === 'captured'`) |
| `timingSafeEqual` everywhere | Tasks 3, 5, 6, 7 |
| Amount validation | Task 6 (`payment.amount !== expectedPaise`) |
| Currency validation | Tasks 5, 6 (`currency !== 'INR'`) |
| Payment id/method/status persistence | Task 4 (`createOrderWithPayment`) |
| Webhook reconciliation | Task 7 (4 event types) |
| Idempotency / replay protection | Task 7 (skip if `webhook_verified = true`) |
| Duplicate payment protection | Task 2 (`UNIQUE INDEX` on `razorpay_payment_id`) |
| Lazily load checkout.js | Task 9 (`await import('@/lib/payments/checkout')` inside handler) |
| Cart preserved on failure/cancel | Task 9 (no `clearCart()` in catch/cancel branch) |
| No secrets in API responses | No payment field returns secrets anywhere |
| All secrets server-only | `RAZORPAY_KEY_SECRET` only in `mei-admin`; no `NEXT_PUBLIC_` prefix |
| Storefront never inserts orders | `mei` proxy routes call `mei-admin`; no Supabase writes in `mei` |
| Orders visible in admin dashboard | Task 4 creates orders with `status: 'CONFIRMED'` |
| Existing tests unchanged | All tasks run full suite before committing |
| No unrelated file modifications | Only `database.ts`, `checkout/page.tsx`, `.env.example` modified |
| UPI/Cards/Net Banking/Wallets/EMI | Not restricted in code — Razorpay dashboard controls enabled methods |
