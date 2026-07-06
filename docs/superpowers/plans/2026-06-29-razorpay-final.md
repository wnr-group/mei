# MEI-20 Razorpay Integration — Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `setTimeout` mock in `src/app/checkout/page.tsx` with a production-grade Razorpay hosted checkout backed entirely by `mei-admin` server-side code.

**Architecture:** The `mei-admin` Next.js app gains three new server-side API routes (`/api/payments/razorpay-order`, `/api/payments/complete-order`, `/api/payments/webhook`) that own all payment logic. The `mei` storefront has two thin proxy API routes (zero business logic) that add a shared secret and forward to `mei-admin`. All Razorpay secrets live exclusively in `mei-admin`. The Razorpay `checkout.js` script is loaded lazily in the browser only when "Pay Now" is clicked.

**Tech Stack:** Razorpay Node.js SDK (`razorpay` npm), Node.js `crypto` (built-in), Next.js 16 App Router API Routes, Supabase service client (`@supabase/supabase-js`), Vitest.

---

## Global Constraints

- `mei` storefront MUST NOT own: payment verification, signature verification, order persistence, inventory updates, webhook reconciliation, refund processing. These live in `mei-admin` only.
- Every task: run `npm run lint && npx tsc --noEmit && npm test` in the affected repo before committing. Stop immediately if a previously passing test fails.
- NEVER modify: Header, Footer, SearchModal, WhatsAppButton, product pages, cart logic, shipping logic, GST logic, checkout form structure/validation/styling, existing admin functionality, existing test files unrelated to payments.
- ADDITIVE ONLY: create files; no rename, move, delete, or rewrite of existing files.
- `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` must never appear in browser-accessible code or API responses.
- Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` may reach the browser.
- Commits: small, named `feat(payment): <description>`.
- Next.js 16.2.6, React 19, Vitest 4, `@supabase/supabase-js` ^2.

---

## Two-Repo Scope

| Repo | Path | Role |
|---|---|---|
| `mei-admin` | `C:\Users\Eshwar\WNR\mei-admin` | Backend — all payment logic, order creation, webhook |
| `mei` | `C:\Users\Eshwar\WNR\mei` | Storefront — UI, thin proxy routes, lazy SDK loader |

Always be in the correct directory before running commands.

---

## Responsibility Boundary (enforced by this plan)

| Responsibility | Owner |
|---|---|
| Razorpay secret key | `mei-admin` only |
| Create Razorpay order (SDK call) | `mei-admin` |
| HMAC signature verification | `mei-admin` |
| Live payment fetch from Razorpay | `mei-admin` |
| Amount / currency validation | `mei-admin` |
| Order creation in DB | `mei-admin` |
| Order items creation | `mei-admin` |
| Customer record creation | `mei-admin` |
| Webhook reconciliation | `mei-admin` |
| Razorpay SDK loading in browser | `mei` |
| Opening Razorpay modal | `mei` |
| Displaying success / failure | `mei` |
| Forwarding requests to `mei-admin` | `mei` (proxy routes only) |

---

## File Map

### Created in `mei-admin`

| File | Purpose |
|---|---|
| `lib/services/razorpay.ts` | SDK wrapper: `createRazorpayOrder`, `fetchPayment`, `verifyPaymentSignature`, `verifyWebhookSignature` |
| `lib/services/payment-orders.ts` | `lookupProductPrices`, `computeTotal`, `createOrderWithPayment` |
| `app/api/payments/razorpay-order/route.ts` | `POST` — creates Razorpay order, returns `razorpay_order_id` |
| `app/api/payments/complete-order/route.ts` | `POST` — verifies HMAC + amount, creates order in DB |
| `app/api/payments/webhook/route.ts` | `POST` — Razorpay webhook handler with HMAC + idempotency |
| `__tests__/services/razorpay.test.ts` | Unit tests for Razorpay service |
| `__tests__/services/payment-orders.test.ts` | Unit tests for order service |
| `__tests__/api/payments/razorpay-order.test.ts` | Route handler tests |
| `__tests__/api/payments/complete-order.test.ts` | Route handler tests |
| `__tests__/api/payments/webhook.test.ts` | Webhook handler tests |

### Modified in `mei-admin`

| File | Change |
|---|---|
| `types/database.ts` | Add 7 payment columns to `orders` Row/Insert/Update |

### Created in `mei`

| File | Purpose |
|---|---|
| `src/lib/payments/loader.ts` | `loadRazorpayScript()` + all Razorpay browser types |
| `src/lib/payments/checkout.ts` | `openRazorpayCheckout()` — opens modal, returns `RazorpayPaymentResponse` |
| `src/app/api/payments/create-razorpay-order/route.ts` | Thin proxy → `mei-admin /api/payments/razorpay-order` |
| `src/app/api/payments/verify/route.ts` | Thin proxy → `mei-admin /api/payments/complete-order` |
| `src/lib/payments/__tests__/loader.test.ts` | Unit test for loader |
| `src/app/api/payments/__tests__/create-razorpay-order.test.ts` | Proxy route tests |
| `src/app/api/payments/__tests__/verify.test.ts` | Proxy route tests |

### Modified in `mei`

| File | Change |
|---|---|
| `src/lib/supabase/database.ts` | Add 7 payment columns to `orders` Row/Insert/Update |
| `src/app/checkout/page.tsx` | Replace `setTimeout` block only; add `paymentError` state; add error `<p>` |
| `.env.example` | Add `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `MEI_ADMIN_API_URL`, `STOREFRONT_API_SECRET` |
| `C:\Users\Eshwar\WNR\mei-admin\.env.example` | Add Razorpay + `STOREFRONT_API_SECRET` vars |

### Database (run in Supabase SQL Editor — not a repo file)

SQL migration adds 7 columns + 2 indexes to `orders` table.

---

## Task 1: Baseline

**Files:** None.

- [ ] **Step 1: Record [mei] baseline**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
```

Write down the passing test count. Every subsequent task must match or exceed it.

- [ ] **Step 2: Record [mei-admin] baseline**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
```

Write down the passing test count.

---

## Task 2: Database Migration + Type Updates

**Files:**
- SQL migration (Supabase dashboard)
- Modify: `C:\Users\Eshwar\WNR\mei\src\lib\supabase\database.ts`
- Modify: `C:\Users\Eshwar\WNR\mei-admin\types\database.ts`

**Interfaces — Produces:**
All subsequent tasks depend on `orders` having these columns in the TypeScript types:
```typescript
razorpay_order_id: string | null
razorpay_payment_id: string | null
payment_method: string | null
payment_status: string | null
payment_captured_at: string | null
webhook_verified: boolean
reconciliation_status: string | null
```

- [ ] **Step 1: Run migration in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → New query. Run:

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

Expected: "Success. No rows returned."

- [ ] **Step 2: Update `mei/src/lib/supabase/database.ts`**

Find the `orders:` block. The current `Row` line ends with `updated_at: string }`. Replace the entire `orders:` block with:

```typescript
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string; razorpay_order_id: string | null; razorpay_payment_id: string | null; payment_method: string | null; payment_status: string | null; payment_captured_at: string | null; webhook_verified: boolean; reconciliation_status: string | null }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
      }
```

- [ ] **Step 3: Update `mei-admin/types/database.ts`**

Find the `orders:` block. The `mei-admin` version already has `deleted_at: string | null` in `Row` and `Update` — keep it. Replace the `orders:` block with:

```typescript
      orders: {
        Row: { id: string; order_number: string; customer_id: string | null; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null; razorpay_order_id: string | null; razorpay_payment_id: string | null; payment_method: string | null; payment_status: string | null; payment_captured_at: string | null; webhook_verified: boolean; reconciliation_status: string | null }
        Insert: { id?: string; order_number?: string; customer_id?: string | null; status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total: number; notes?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
        Update: { status?: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; total?: number; notes?: string | null; deleted_at?: string | null; razorpay_order_id?: string | null; razorpay_payment_id?: string | null; payment_method?: string | null; payment_status?: string | null; payment_captured_at?: string | null; webhook_verified?: boolean; reconciliation_status?: string | null }
      }
```

- [ ] **Step 4: Verify both repos compile**

```
cd C:\Users\Eshwar\WNR\mei && npx tsc --noEmit
cd C:\Users\Eshwar\WNR\mei-admin && npx tsc --noEmit
```

Expected: zero errors in both.

- [ ] **Step 5: Commit**

```
cd C:\Users\Eshwar\WNR\mei
git add src/lib/supabase/database.ts
git commit -m "feat(payment): add Razorpay payment columns to orders type"

cd C:\Users\Eshwar\WNR\mei-admin
git add types/database.ts
git commit -m "feat(payment): add Razorpay payment columns to orders type"
```

---

## Task 3: Razorpay Service Wrapper [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\lib\services\razorpay.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\razorpay.test.ts`

**Interfaces — Produces:**
```typescript
// razorpay.ts exports:
createRazorpayOrder(params: { amount_paise: number; currency: 'INR'; receipt: string }): Promise<{ razorpay_order_id: string; amount: number; currency: string }>

type RazorpayPayment = { id: string; amount: number; status: string; method: string; order_id: string }
fetchPayment(paymentId: string): Promise<RazorpayPayment>

verifyPaymentSignature(params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }): boolean

verifyWebhookSignature(rawBody: string, signature: string): boolean
```

- [ ] **Step 1: Install Razorpay SDK**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm install razorpay
```

Expected: `"razorpay"` appears in `package.json` dependencies.

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
      fetch: vi.fn().mockResolvedValue({
        id: 'pay_test456', amount: 100000, status: 'captured', method: 'upi', order_id: 'order_test123',
      }),
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
  it('returns normalised payment object', async () => {
    const { fetchPayment } = await import('@/lib/services/razorpay')
    const p = await fetchPayment('pay_test456')
    expect(p.status).toBe('captured')
    expect(p.amount).toBe(100000)
    expect(p.method).toBe('upi')
  })
})

describe('verifyPaymentSignature', () => {
  it('returns true for correct HMAC', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    const sig = createHmac('sha256', 'test_secret_abc')
      .update('order_test123|pay_test456')
      .digest('hex')
    expect(verifyPaymentSignature({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test456', razorpay_signature: sig })).toBe(true)
  })

  it('returns false for tampered signature', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    expect(verifyPaymentSignature({ razorpay_order_id: 'order_test123', razorpay_payment_id: 'pay_test456', razorpay_signature: 'deadbeef00' })).toBe(false)
  })

  it('returns false for wrong-length / non-hex signature', async () => {
    const { verifyPaymentSignature } = await import('@/lib/services/razorpay')
    expect(verifyPaymentSignature({ razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'short' })).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  it('returns true for valid webhook HMAC', async () => {
    const { verifyWebhookSignature } = await import('@/lib/services/razorpay')
    const body = '{"event":"payment.captured"}'
    const sig = createHmac('sha256', 'webhook_secret_xyz').update(body).digest('hex')
    expect(verifyWebhookSignature(body, sig)).toBe(true)
  })

  it('returns false for invalid signature', async () => {
    const { verifyWebhookSignature } = await import('@/lib/services/razorpay')
    expect(verifyWebhookSignature('{}', 'badsig')).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

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
    _instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! })
  }
  return _instance
}

export async function createRazorpayOrder(params: {
  amount_paise: number
  currency: 'INR'
  receipt: string
}): Promise<{ razorpay_order_id: string; amount: number; currency: string }> {
  const order = await getInstance().orders.create({ amount: params.amount_paise, currency: params.currency, receipt: params.receipt })
  return {
    razorpay_order_id: order.id,
    amount: typeof order.amount === 'string' ? parseInt(order.amount, 10) : order.amount,
    currency: order.currency,
  }
}

export type RazorpayPayment = { id: string; amount: number; status: string; method: string; order_id: string }

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
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${params.razorpay_order_id}|${params.razorpay_payment_id}`)
    .digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(params.razorpay_signature, 'hex'))
  } catch {
    return false
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/services/razorpay.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 6: Full check + commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add lib/services/razorpay.ts __tests__/services/razorpay.test.ts package.json package-lock.json
git commit -m "feat(payment): add Razorpay SDK wrapper with timingSafeEqual HMAC"
```

---

## Task 4: Payment Order Service [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\lib\services\payment-orders.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\payment-orders.test.ts`

**Interfaces — Produces:**
```typescript
export const FREE_SHIPPING_THRESHOLD = 5000
export const SHIPPING_FLAT_RATE = 150

export type CartItemInput = { product_id: string; quantity: number }
export type CustomerInput = {
  name: string; email: string; phone: string; city: string
  address_line1: string; address_line2?: string
  state: string; pincode: string; country: string
}

lookupProductPrices(items: CartItemInput[]): Promise<Map<string, { name: string; price: number }>>
computeTotal(items: CartItemInput[], priceMap: Map<string, { name: string; price: number }>): { subtotal: number; shipping: number; total: number }
createOrderWithPayment(params: { customer, cartItems, priceMap, razorpayOrderId, razorpayPaymentId, paymentMethod, totalINR }): Promise<{ order_id: string; order_number: string }>
```

Note on "inventory updated": MEI is a made-to-order couture brand with no stock count. Creating `order_items` records IS the inventory deduction. No additional inventory table updates are needed.

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\services\payment-orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIs = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_key'
  vi.resetModules()
})

describe('computeTotal', () => {
  it('charges flat shipping when subtotal < 5000', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['p1', { name: 'Lehenga', price: 3000 }]])
    const r = computeTotal([{ product_id: 'p1', quantity: 1 }], priceMap)
    expect(r.subtotal).toBe(3000)
    expect(r.shipping).toBe(150)
    expect(r.total).toBe(3150)
  })

  it('gives free shipping when subtotal >= 5000', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['p1', { name: 'Saree', price: 6000 }]])
    const r = computeTotal([{ product_id: 'p1', quantity: 1 }], priceMap)
    expect(r.shipping).toBe(0)
    expect(r.total).toBe(6000)
  })

  it('throws when product_id missing from priceMap', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    expect(() => computeTotal([{ product_id: 'missing', quantity: 1 }], new Map())).toThrow('Product missing not found')
  })

  it('multiplies quantity across multiple items', async () => {
    const { computeTotal } = await import('@/lib/services/payment-orders')
    const priceMap = new Map([['a', { name: 'A', price: 2000 }], ['b', { name: 'B', price: 1500 }]])
    const r = computeTotal([{ product_id: 'a', quantity: 2 }, { product_id: 'b', quantity: 1 }], priceMap)
    expect(r.subtotal).toBe(5500)
    expect(r.shipping).toBe(0)
  })
})

describe('lookupProductPrices', () => {
  it('returns Map of id → {name, price}', async () => {
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockReturnValue({
          eq: mockEq.mockReturnValue({
            is: mockIs.mockResolvedValue({ data: [{ id: 'p1', name: 'Lehenga', price: 3000 }], error: null }),
          }),
        }),
      }),
    })
    const { lookupProductPrices } = await import('@/lib/services/payment-orders')
    const m = await lookupProductPrices([{ product_id: 'p1', quantity: 1 }])
    expect(m.get('p1')).toEqual({ name: 'Lehenga', price: 3000 })
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

- [ ] **Step 2: Run tests — verify they fail**

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
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type CartItemInput = { product_id: string; quantity: number }

export type CustomerInput = {
  name: string; email: string; phone: string; city: string
  address_line1: string; address_line2?: string
  state: string; pincode: string; country: string
}

type ProductRow = { id: string; name: string; price: number }

export async function lookupProductPrices(cartItems: CartItemInput[]): Promise<Map<string, { name: string; price: number }>> {
  const { data, error } = await getServiceClient()
    .from('products')
    .select('id, name, price')
    .in('id', cartItems.map((i) => i.product_id))
    .eq('status', 'PUBLISHED')
    .is('deleted_at', null) as { data: ProductRow[] | null; error: { message: string } | null }

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
    shipping: { line1: customer.address_line1, line2: customer.address_line2 ?? null, state: customer.state, pincode: customer.pincode, country: customer.country },
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

  const { error: itemsError } = await supabase.from('order_items').insert(
    cartItems.map((item) => {
      const product = priceMap.get(item.product_id)!
      return { order_id: order.id, product_id: item.product_id, product_name: product.name, quantity: item.quantity, unit_price: product.price }
    })
  )
  if (itemsError) throw new Error('Failed to create order items')

  return { order_id: order.id, order_number: order.order_number }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/services/payment-orders.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Full check + commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add lib/services/payment-orders.ts __tests__/services/payment-orders.test.ts
git commit -m "feat(payment): add order creation service with server-side price validation"
```

---

## Task 5: Create Razorpay Order Endpoint [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\app\api\payments\razorpay-order\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\razorpay-order.test.ts`

**Interfaces:**
- Consumes: `createRazorpayOrder` from `@/lib/services/razorpay`; `lookupProductPrices`, `computeTotal`, `CartItemInput` from `@/lib/services/payment-orders`
- Auth: `Authorization: Bearer <STOREFRONT_API_SECRET>` header
- Produces: `POST /api/payments/razorpay-order`
  - Request: `{ cart_items: CartItemInput[], currency: 'INR' }`
  - Response 200: `{ razorpay_order_id: string, amount_paise: number, currency: 'INR' }`

```typescript
// Helper used in Tasks 5 AND 6 — define once, repeat here for each task
function verifyStorefrontAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.STOREFRONT_API_SECRET ?? ''}`
  if (auth.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(auth)) } catch { return false }
}
```

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

function makeReq(body: unknown, secret = 'shared_secret') {
  return new NextRequest('http://localhost/api/payments/razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body: JSON.stringify(body),
  })
}

beforeEach(() => { process.env.STOREFRONT_API_SECRET = 'shared_secret'; vi.resetModules() })

describe('POST /api/payments/razorpay-order', () => {
  it('returns razorpay_order_id and amount_paise', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    const res = await POST(makeReq({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.razorpay_order_id).toBe('order_abc')
    expect(data.amount_paise).toBe(315000)
  })

  it('returns 401 without Authorization', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    const req = new NextRequest('http://localhost/api/payments/razorpay-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }),
    })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 401 with wrong secret', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeReq({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }, 'wrong'))).status).toBe(401)
  })

  it('returns 400 for non-INR currency', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeReq({ cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'USD' }))).status).toBe(400)
  })

  it('returns 400 for empty cart_items', async () => {
    const { POST } = await import('@/app/api/payments/razorpay-order/route')
    expect((await POST(makeReq({ cart_items: [], currency: 'INR' }))).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

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
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(auth)) } catch { return false }
}

export async function POST(request: NextRequest) {
  if (!verifyStorefrontAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { cart_items: CartItemInput[]; currency: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { cart_items, currency } = body
  if (!Array.isArray(cart_items) || cart_items.length === 0) return NextResponse.json({ error: 'cart_items required' }, { status: 400 })
  if (currency !== 'INR') return NextResponse.json({ error: 'Only INR supported' }, { status: 400 })

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

- [ ] **Step 4: Run tests — verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/razorpay-order.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Full check + commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add app/api/payments/razorpay-order/route.ts __tests__/api/payments/razorpay-order.test.ts
git commit -m "feat(payment): add create-razorpay-order API endpoint"
```

---

## Task 6: Complete Order Endpoint [mei-admin]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei-admin\app\api\payments\complete-order\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\complete-order.test.ts`

**Interfaces:**
- Consumes: `verifyPaymentSignature`, `fetchPayment`, `RazorpayPayment` from `@/lib/services/razorpay`; `lookupProductPrices`, `computeTotal`, `createOrderWithPayment`, `CustomerInput`, `CartItemInput` from `@/lib/services/payment-orders`
- Auth: `Authorization: Bearer <STOREFRONT_API_SECRET>`
- Produces: `POST /api/payments/complete-order`
  - Request: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, customer: CustomerInput, cart_items: CartItemInput[], currency: 'INR' }`
  - Response 200: `{ order_number: string }`
  - Response 400: invalid signature | payment not captured | amount mismatch | missing fields | wrong currency

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\complete-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifySig = vi.fn()
const mockFetchPayment = vi.fn()
const mockLookup = vi.fn()
const mockCompute = vi.fn()
const mockCreateOrder = vi.fn()

vi.mock('@/lib/services/razorpay', () => ({ verifyPaymentSignature: mockVerifySig, fetchPayment: mockFetchPayment }))
vi.mock('@/lib/services/payment-orders', () => ({
  lookupProductPrices: mockLookup,
  computeTotal: mockCompute,
  createOrderWithPayment: mockCreateOrder,
}))

const customer = { name: 'Priya', email: 'p@t.com', phone: '+91 9999999999', city: 'Mumbai', address_line1: '1 MG Rd', state: 'MH', pincode: '400001', country: 'India' }
const validBody = { razorpay_order_id: 'order_abc', razorpay_payment_id: 'pay_xyz', razorpay_signature: 'sig', customer, cart_items: [{ product_id: 'p1', quantity: 1 }], currency: 'INR' }

function makeReq(body: unknown, secret = 'shared_secret') {
  return new NextRequest('http://localhost/api/payments/complete-order', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` }, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STOREFRONT_API_SECRET = 'shared_secret'
  mockVerifySig.mockReturnValue(true)
  mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 315000, status: 'captured', method: 'upi', order_id: 'order_abc' })
  mockLookup.mockResolvedValue(new Map([['p1', { name: 'Lehenga', price: 3000 }]]))
  mockCompute.mockReturnValue({ subtotal: 3000, shipping: 150, total: 3150 })
  mockCreateOrder.mockResolvedValue({ order_id: 'uuid-1', order_number: 'MEI-100001' })
  vi.resetModules()
})

describe('POST /api/payments/complete-order', () => {
  it('returns order_number on success', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    expect((await res.json()).order_number).toBe('MEI-100001')
  })

  it('returns 401 without Authorization', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const req = new NextRequest('http://localhost/api/payments/complete-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) })
    expect((await POST(req)).status).toBe(401)
  })

  it('returns 400 for invalid signature', async () => {
    mockVerifySig.mockReturnValue(false)
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/signature/i)
  })

  it('returns 400 when payment not captured', async () => {
    mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 315000, status: 'failed', method: 'upi', order_id: 'order_abc' })
    const { POST } = await import('@/app/api/payments/complete-order/route')
    expect((await POST(makeReq(validBody))).status).toBe(400)
  })

  it('returns 400 when payment amount mismatches server total', async () => {
    mockFetchPayment.mockResolvedValue({ id: 'pay_xyz', amount: 100000, status: 'captured', method: 'upi', order_id: 'order_abc' })
    const { POST } = await import('@/app/api/payments/complete-order/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/amount/i)
  })

  it('returns 400 for non-INR currency', async () => {
    const { POST } = await import('@/app/api/payments/complete-order/route')
    expect((await POST(makeReq({ ...validBody, currency: 'USD' }))).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

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
import { lookupProductPrices, computeTotal, createOrderWithPayment, type CustomerInput, type CartItemInput } from '@/lib/services/payment-orders'

function verifyStorefrontAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.STOREFRONT_API_SECRET ?? ''}`
  if (auth.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(auth)) } catch { return false }
}

export async function POST(request: NextRequest) {
  if (!verifyStorefrontAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; customer: CustomerInput; cart_items: CartItemInput[]; currency: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer, cart_items, currency } = body
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  if (!customer?.name || !customer?.email) return NextResponse.json({ error: 'Missing customer fields' }, { status: 400 })
  if (!Array.isArray(cart_items) || cart_items.length === 0) return NextResponse.json({ error: 'cart_items required' }, { status: 400 })
  if (currency !== 'INR') return NextResponse.json({ error: 'Only INR supported' }, { status: 400 })

  if (!verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  let payment: Awaited<ReturnType<typeof fetchPayment>>
  try { payment = await fetchPayment(razorpay_payment_id) } catch {
    return NextResponse.json({ error: 'Failed to fetch payment from Razorpay' }, { status: 502 })
  }

  if (payment.status !== 'captured') return NextResponse.json({ error: `Payment not captured: ${payment.status}` }, { status: 400 })

  let priceMap: Map<string, { name: string; price: number }>
  try { priceMap = await lookupProductPrices(cart_items) } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Product lookup failed' }, { status: 400 })
  }

  const { total: totalINR } = computeTotal(cart_items, priceMap)
  const expectedPaise = Math.round(totalINR * 100)
  if (payment.amount !== expectedPaise) {
    return NextResponse.json({ error: `Amount mismatch: expected ${expectedPaise}, got ${payment.amount}` }, { status: 400 })
  }

  try {
    const result = await createOrderWithPayment({ customer, cartItems: cart_items, priceMap, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, paymentMethod: payment.method, totalINR })
    return NextResponse.json({ order_number: result.order_number })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create order' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/complete-order.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Full check + commit**

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
- Auth: `x-razorpay-signature` header (HMAC from Razorpay, NOT the storefront secret)
- Idempotency: check `webhook_verified` before updating `payment.captured`
- Produces: `POST /api/payments/webhook` — 200 always after HMAC check (prevents Razorpay retries on DB misses)

- [ ] **Step 1: Write the failing tests**

Create `C:\Users\Eshwar\WNR\mei-admin\__tests__\api\payments\webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyWebhook = vi.fn()
const mockMaybeSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/services/razorpay', () => ({ verifyWebhookSignature: mockVerifyWebhook }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: mockFrom })) }))

function makeReq(body: unknown, sig = 'valid_sig') {
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_key'
  mockVerifyWebhook.mockReturnValue(true)
  mockMaybeSingle.mockResolvedValue({ data: { id: 'ord-uuid', webhook_verified: false }, error: null })
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockUpdateEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockUpdateEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  vi.resetModules()
})

describe('POST /api/payments/webhook', () => {
  it('returns 400 for invalid signature', async () => {
    mockVerifyWebhook.mockReturnValue(false)
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeReq({ event: 'payment.captured' }, 'bad'))).status).toBe(400)
  })

  it('returns 200 with received:true for payment.captured', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'order_rzp', method: 'upi' } } } }
    const res = await POST(makeReq(payload))
    expect(res.status).toBe(200)
    expect((await res.json()).received).toBe(true)
  })

  it('returns 200 for payment.failed', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeReq({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'ord_rzp' } } } }))).status).toBe(200)
  })

  it('skips DB update when webhook_verified already true (idempotency)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'ord-uuid', webhook_verified: true }, error: null })
    const { POST } = await import('@/app/api/payments/webhook/route')
    const payload = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_xyz', order_id: 'ord_rzp', method: 'upi' } } } }
    await POST(makeReq(payload))
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 200 for unknown event types', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route')
    expect((await POST(makeReq({ event: 'order.paid', payload: {} }))).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

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
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type PaymentEntity = { id?: string; order_id?: string; method?: string }
type RefundEntity = { id?: string; payment_id?: string }
type WebhookPayload = { payment?: { entity?: PaymentEntity }; refund?: { entity?: RefundEntity } }

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event: string; payload: WebhookPayload }
  try { event = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const supabase = getServiceClient()

  switch (event.event) {
    case 'payment.captured': {
      const p = event.payload.payment?.entity
      if (!p?.order_id) break
      const { data: existing } = await supabase.from('orders').select('id, webhook_verified').eq('razorpay_order_id', p.order_id).maybeSingle()
      if (existing?.webhook_verified) break
      await supabase.from('orders').update({ payment_status: 'captured', webhook_verified: true, razorpay_payment_id: p.id ?? null, payment_method: p.method ?? null, payment_captured_at: new Date().toISOString() }).eq('razorpay_order_id', p.order_id)
      break
    }
    case 'payment.failed': {
      const p = event.payload.payment?.entity
      if (!p?.order_id) break
      await supabase.from('orders').update({ payment_status: 'failed', webhook_verified: true }).eq('razorpay_order_id', p.order_id)
      break
    }
    case 'refund.created': {
      const r = event.payload.refund?.entity
      if (!r?.payment_id) break
      await supabase.from('orders').update({ reconciliation_status: 'refund_initiated' }).eq('razorpay_payment_id', r.payment_id)
      break
    }
    case 'refund.processed': {
      const r = event.payload.refund?.entity
      if (!r?.payment_id) break
      await supabase.from('orders').update({ reconciliation_status: 'refund_processed' }).eq('razorpay_payment_id', r.payment_id)
      break
    }
    default:
      console.log(`[webhook] Unhandled event: ${event.event}`)
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run test:run -- __tests__/api/payments/webhook.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Full check + commit**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
git add app/api/payments/webhook/route.ts __tests__/api/payments/webhook.test.ts
git commit -m "feat(payment): add webhook handler with HMAC verification and idempotency"
```

---

## Task 8: Storefront Payment Layer [mei]

**Files:**
- Create: `C:\Users\Eshwar\WNR\mei\src\lib\payments\loader.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\lib\payments\checkout.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\create-razorpay-order\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\verify\route.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\lib\payments\__tests__\loader.test.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\create-razorpay-order.test.ts`
- Create: `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\verify.test.ts`

**Interfaces — Produces:**
```typescript
// loader.ts
export type RazorpayPaymentResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
export function loadRazorpayScript(): Promise<void>

// checkout.ts
export function openRazorpayCheckout(options: { razorpay_order_id, amount_paise, currency: 'INR', customer_name, customer_email, customer_phone }): Promise<RazorpayPaymentResponse>

// proxy routes:
// POST /api/payments/create-razorpay-order → mei-admin /api/payments/razorpay-order
// POST /api/payments/verify → mei-admin /api/payments/complete-order
```

Why proxy routes? To keep `MEI_ADMIN_API_URL` and `STOREFRONT_API_SECRET` server-side. The browser never sees the admin URL or shared secret.

- [ ] **Step 1: Write the failing loader test**

Create `C:\Users\Eshwar\WNR\mei\src\lib\payments\__tests__\loader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { loadRazorpayScript } from '../loader'

describe('loadRazorpayScript', () => {
  it('rejects when called outside a browser (node environment)', async () => {
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
  key: string; amount: number; currency: string; name: string; description?: string; order_id: string
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
    if (typeof window === 'undefined') { reject(new Error('Not in browser')); return }
    if (window.Razorpay) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay script'))
    document.body.appendChild(script)
  })
}
```

- [ ] **Step 4: Run loader test — verify it passes**

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
      prefill: { name: options.customer_name, email: options.customer_email, contact: options.customer_phone },
      theme: { color: '#c9a465' },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment cancelled by user')) },
    })
    rzp.on('payment.failed', (response: unknown) => reject(response))
    rzp.open()
  })
}
```

- [ ] **Step 6: Write proxy route tests**

Create `C:\Users\Eshwar\WNR\mei\src\app\api\payments\__tests__\create-razorpay-order.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.MEI_ADMIN_API_URL = 'http://localhost:3001'
  process.env.STOREFRONT_API_SECRET = 'shared_secret'
  vi.resetModules()
})

describe('POST /api/payments/create-razorpay-order', () => {
  it('proxies to mei-admin with auth header and returns response', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ razorpay_order_id: 'order_abc', amount_paise: 315000, currency: 'INR' }), status: 200 })
    const { POST } = await import('../create-razorpay-order/route')
    const res = await POST(new NextRequest('http://localhost/api/payments/create-razorpay-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart_items: [{ product_id: 'p1', quantity: 1 }] }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).razorpay_order_id).toBe('order_abc')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/payments/razorpay-order', expect.objectContaining({
      headers: expect.objectContaining({ 'Authorization': 'Bearer shared_secret' }),
    }))
  })

  it('returns 503 when MEI_ADMIN_API_URL is not set', async () => {
    delete process.env.MEI_ADMIN_API_URL
    const { POST } = await import('../create-razorpay-order/route')
    expect((await POST(new NextRequest('http://localhost/api/payments/create-razorpay-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }))).status).toBe(503)
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
  process.env.STOREFRONT_API_SECRET = 'shared_secret'
  vi.resetModules()
})

describe('POST /api/payments/verify', () => {
  it('proxies to mei-admin and returns order_number', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ order_number: 'MEI-100001' }), status: 200 })
    const { POST } = await import('../verify/route')
    const res = await POST(new NextRequest('http://localhost/api/payments/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' }),
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).order_number).toBe('MEI-100001')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/payments/complete-order', expect.objectContaining({
      headers: expect.objectContaining({ 'Authorization': 'Bearer shared_secret' }),
    }))
  })

  it('returns 503 when MEI_ADMIN_API_URL is not set', async () => {
    delete process.env.MEI_ADMIN_API_URL
    const { POST } = await import('../verify/route')
    expect((await POST(new NextRequest('http://localhost/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }))).status).toBe(503)
  })
})
```

- [ ] **Step 7: Run proxy tests — verify they fail**

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
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const adminUrl = process.env.MEI_ADMIN_API_URL
  if (!adminUrl) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  const response = await fetch(`${adminUrl}/api/payments/razorpay-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.STOREFRONT_API_SECRET}` },
    body: JSON.stringify({ ...(body as object), currency: 'INR' }),
  })
  return NextResponse.json(await response.json(), { status: response.status })
}
```

- [ ] **Step 9: Create `src/app/api/payments/verify/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const adminUrl = process.env.MEI_ADMIN_API_URL
  if (!adminUrl) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

  const response = await fetch(`${adminUrl}/api/payments/complete-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.STOREFRONT_API_SECRET}` },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await response.json(), { status: response.status })
}
```

- [ ] **Step 10: Run all new tests — verify they pass**

```
cd C:\Users\Eshwar\WNR\mei
npm test -- src/lib/payments/__tests__/ src/app/api/payments/__tests__/
```

Expected: 5 tests PASS.

- [ ] **Step 11: Full check + commit**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
git add src/lib/payments/ src/app/api/payments/
git commit -m "feat(payment): add Razorpay SDK loader, modal helper, and proxy API routes"
```

---

## Task 9: Checkout Integration + Environment Variables [mei]

**CRITICAL — Exact change scope:**

| Element | Action |
|---|---|
| `const handleSubmit = (e: React.FormEvent)` | → becomes `async` |
| `setTimeout(...)` 5-line block | → replace with real payment flow |
| `setIsSubmitting(false)` inside setTimeout | → moved to `finally` |
| `clearCart()` inside setTimeout | → moved to success path only |
| `setOrderId(mockOrderId)` inside setTimeout | → replaced with real `order_number` |
| All other JSX, styles, form fields, validations | unchanged |
| New: `const [paymentError, ...]` state | added |
| New: `{paymentError && <p>...}` | added below submit button |

**Files:**
- Modify: `C:\Users\Eshwar\WNR\mei\src\app\checkout\page.tsx`
- Modify: `C:\Users\Eshwar\WNR\mei\.env.example`
- Modify: `C:\Users\Eshwar\WNR\mei-admin\.env.example`

- [ ] **Step 1: Read the checkout page to confirm line numbers**

Open and read `src/app/checkout/page.tsx`. Confirm `handleSubmit` is around line 105 and uses `setTimeout(() => { ... }, 1800)`.

- [ ] **Step 2: Add `paymentError` state**

After the line:
```typescript
  const [isSubmitting, setIsSubmitting] = useState(false);
```
Add immediately below it:
```typescript
  const [paymentError, setPaymentError] = useState<string | null>(null);
```

- [ ] **Step 3: Replace `handleSubmit`**

Replace the entire function (starting at `const handleSubmit` through the closing `};`) with:

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

- [ ] **Step 4: Add payment error display**

Find this element (the "Secured by Razorpay" line):
```tsx
              <p className="text-center text-xs uppercase tracking-widest text-[#9a9a9a] font-bold select-none">
                🔒 Secured by Razorpay
              </p>
```

Add this block immediately above it (between the closing `</button>` tag and this paragraph):
```tsx
              {paymentError && (
                <p className="text-xs text-red-500 text-center font-inter">{paymentError}</p>
              )}
```

- [ ] **Step 5: Update `mei/.env.example`**

Append to `C:\Users\Eshwar\WNR\mei\.env.example`:
```
# Razorpay — public key only (safe for browser)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id_here

# mei-admin base URL — server-side only, never use NEXT_PUBLIC prefix
MEI_ADMIN_API_URL=http://localhost:3001

# Shared secret between mei and mei-admin — server-side only
# Generate with: openssl rand -hex 32
STOREFRONT_API_SECRET=replace_with_secure_random_string
```

- [ ] **Step 6: Update `mei-admin/.env.example`**

Append to `C:\Users\Eshwar\WNR\mei-admin\.env.example`:
```
# Razorpay — all keys server-side only, NEVER use NEXT_PUBLIC prefix
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay_dashboard

# Shared secret for verifying requests from mei storefront
# Must match STOREFRONT_API_SECRET in mei — generate with: openssl rand -hex 32
STOREFRONT_API_SECRET=replace_with_secure_random_string
```

- [ ] **Step 7: Full check**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
```

Expected: lint clean, zero type errors, all prior tests pass (count from Task 1 baseline + new tests from Task 8).

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

- [ ] **Step 1: Final suite [mei]**

```
cd C:\Users\Eshwar\WNR\mei
npm run lint && npx tsc --noEmit && npm test
```

Expected: ≥ Task 1 baseline passing count, zero new failures.

- [ ] **Step 2: Final suite [mei-admin]**

```
cd C:\Users\Eshwar\WNR\mei-admin
npm run lint && npx tsc --noEmit && npm run test:run
```

Expected: ≥ Task 1 baseline passing count, zero new failures.

- [ ] **Step 3: Security checklist (grep)**

Run each command — verify ZERO matches for the dangerous patterns:

```
grep -r "NEXT_PUBLIC_RAZORPAY_KEY_SECRET" C:\Users\Eshwar\WNR\mei\src
grep -r "NEXT_PUBLIC_RAZORPAY_WEBHOOK" C:\Users\Eshwar\WNR\mei\src
grep -r "key_secret" C:\Users\Eshwar\WNR\mei\src
```

Also confirm `verifyPaymentSignature`, `verifyWebhookSignature`, and `verifyStorefrontAuth` all use `timingSafeEqual`:

```
grep -n "timingSafeEqual" C:\Users\Eshwar\WNR\mei-admin\lib\services\razorpay.ts
grep -n "timingSafeEqual" C:\Users\Eshwar\WNR\mei-admin\app\api\payments\razorpay-order\route.ts
grep -n "timingSafeEqual" C:\Users\Eshwar\WNR\mei-admin\app\api\payments\complete-order\route.ts
```

Each must show at least one match.

- [ ] **Step 4: Razorpay dashboard setup (manual — one-time)**

1. **Test API Keys** → Razorpay Test Dashboard → Settings → API Keys → Generate  
   - Key ID → `NEXT_PUBLIC_RAZORPAY_KEY_ID` in `mei` AND `RAZORPAY_KEY_ID` in `mei-admin`  
   - Key Secret → `RAZORPAY_KEY_SECRET` in `mei-admin` only

2. **Webhook** → Razorpay Test Dashboard → Settings → Webhooks → Add  
   URL: `https://<your-mei-admin-domain>/api/payments/webhook`  
   Subscribe: `payment.captured`, `payment.failed`, `refund.created`, `refund.processed`  
   Webhook secret → `RAZORPAY_WEBHOOK_SECRET` in `mei-admin`

3. **Shared secret** → run `openssl rand -hex 32` → paste into `STOREFRONT_API_SECRET` in BOTH `.env.local` files

4. **Admin URL** → set `MEI_ADMIN_API_URL=http://localhost:3001` in `mei` `.env.local`

- [ ] **Step 5: End-to-end smoke test (manual in browser)**

Start: `mei` on port 3000 (`npm run dev`), `mei-admin` on port 3001 (`npm run dev`).

**Happy path:**
1. Add a product to cart → go to `/checkout` → fill all fields → click "Pay Now"
2. Razorpay modal opens (not the browser's native form submit)
3. Enter test card: `4111 1111 1111 1111` / Expiry `12/26` / CVV `123`
4. Payment completes → checkout page shows success view with real `order_number` like `MEI-XXXXXX`
5. `mei-admin` `/orders` page shows the order with status CONFIRMED, payment_id, and payment_method visible

**Cancel path:**
1. Add product → checkout → "Pay Now" → close modal with X
2. Checkout form still showing, cart intact, no error message, `isSubmitting = false`

**Fail path:**
1. Add product → checkout → "Pay Now" → use declined card `4000 0000 0000 0002`
2. Razorpay shows failure → checkout form returns → red error message appears below "Pay Now" button → cart intact

---

## Spec Coverage Matrix

| Spec requirement | Task | Evidence |
|---|---|---|
| Hosted Checkout Modal | 9 | `openRazorpayCheckout` via dynamic import |
| Backend creates Razorpay order | 5 | `app/api/payments/razorpay-order/route.ts` in `mei-admin` |
| HMAC signature verification | 6 | `verifyPaymentSignature` with `timingSafeEqual` |
| Live payment fetch from Razorpay | 6 | `fetchPayment` → check `status === 'captured'` |
| `timingSafeEqual` everywhere | 3, 5, 6, 7 | All 4 HMAC comparisons |
| Amount validation | 6 | `payment.amount !== expectedPaise` |
| Currency validation | 5, 6 | `currency !== 'INR'` |
| Order persistence in DB | 4 | `createOrderWithPayment` |
| Inventory updated | 4 | `order_items` rows created (MEI = made-to-order, no stock count) |
| Admin sees order + payment_id | 4 | `razorpay_payment_id` column persisted |
| Webhook reconciliation | 7 | 4 event types handled |
| Idempotency / replay protection | 7 | Skip if `webhook_verified = true` |
| Duplicate payment protection | 2 | `UNIQUE INDEX` on `razorpay_payment_id` |
| Lazy SDK load | 9 | `await import('@/lib/payments/checkout')` inside handler |
| Cart preserved on failure/cancel | 9 | `clearCart()` only in success path |
| No secrets in responses | 5, 6 | No secret fields in `NextResponse.json(...)` |
| Secrets server-only | 3–9 | `RAZORPAY_KEY_SECRET` only in `mei-admin`; no `NEXT_PUBLIC_` prefix |
| Storefront does not own verification | 8 | Proxy routes contain zero crypto/DB logic |
| UPI / Cards / Net Banking / Wallets / EMI | 9 | No `method` restriction in checkout options |
| Existing tests unchanged | All | Full suite run after every task |
| No unrelated file modifications | All | Only listed files modified |
