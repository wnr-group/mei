# Razorpay Hosted Checkout — Design Spec

**Date:** 2026-06-30
**Branch:** feat/storefront-checkout-razorpay-integration
**Scope:** `src/app/checkout/page.tsx` only

---

## Problem

`handleSubmit` in `src/app/checkout/page.tsx` (lines 105–118) is entirely mock code. It generates a fake `MEI-XXXXXX` order ID after a 1.8-second `setTimeout`, clears the cart, and shows the confirmation screen — without ever calling Razorpay or creating a real order.

All required infrastructure already exists and is unused:
- `/api/razorpay/create-order` — server-side price verification, Razorpay API call, bypass mode
- `src/lib/services/orders.ts` `createOrder()` — calls the Supabase Edge Function
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — set in `.env.local`
- `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true` — active in `.env.local`

---

## Approach

**Inline in `page.tsx` — no new files, no new hooks, no architectural changes.**

The Razorpay flow is three sequential steps (API call → modal → service call). It is entirely self-contained within one component with no reuse across pages. Extraction would add scope without benefit.

---

## Changes Restricted To

- `src/app/checkout/page.tsx`
  - Add one `useEffect` for script loading
  - Add one state variable: `paymentError: string | null`
  - Replace the mock `handleSubmit` body with the real payment flow

Everything else in the file (form fields, validation, UI structure, shipping logic, styling) is untouched.

---

## Script Loading

A single `useEffect` on mount injects `https://checkout.razorpay.com/v1/checkout.js` into `document.body` if the script tag is not already present. It runs unconditionally in both bypass and real modes so both paths share one code route. No load-status state is needed — the form requires several seconds to fill before `handleSubmit` can be triggered.

---

## State Additions

| Variable | Type | Purpose |
|---|---|---|
| `paymentError` | `string \| null` | Inline error shown below Pay Now button |

`paymentError` is rendered as a `<p>` below the submit button using existing `text-xs text-red-500 font-inter` styling. It is cleared at the start of every submission attempt.

No other state changes. `isSubmitting` is reused as-is for button disabled state and spinner.

---

## `handleSubmit` — Complete Flow

### Entry Guards

```
if (isSubmitting) return;                          // prevent duplicate submissions
if (!validate()) return;                           // existing validation unchanged
setPaymentError(null);                             // clear previous error
setIsSubmitting(true);
```

### Step 1 — Create Razorpay Order (Server-Side)

```
POST /api/razorpay/create-order
Body: { items: [{ product_id, quantity }] }
```

- Amount is always server-generated. Frontend totals are never trusted.
- On non-OK response: `setPaymentError("Unable to initiate payment. Please try again.")`, `setIsSubmitting(false)`, return.

Response destructured: `{ razorpay_order_id, amount, currency, key_id, bypass }`

### Step 2 — Bypass Path (`bypass === true`)

Skips the modal entirely. Calls `createOrder()` with synthetic payment identifiers.

```
try {
  const result = await createOrder({
    customer: { name, email, phone, city },
    items: cartItems,
    shipping_address: { addressLine1, addressLine2, city, state, pincode, country: "India" },
    payment: {
      provider: "razorpay",
      payment_id: "bypass_pay_id",
      order_id: razorpay_order_id,
      signature: "bypass_sig",
    },
  });
  clearCart();                      // only after createOrder succeeds
  setOrderId(result.orderNumber);   // only after createOrder succeeds
} catch (err) {
  setPaymentError("Order creation failed. Please try again.");
  // cart NOT cleared
} finally {
  setIsSubmitting(false);           // always resets
}
```

### Step 3 — Real Razorpay Path

#### SDK Guard

```
if (!window.Razorpay) {
  setPaymentError("Payment service unavailable. Please refresh and try again.");
  setIsSubmitting(false);
  return;
}
```

#### Razorpay Options

```ts
{
  key: key_id,                    // server-returned, never client-generated
  amount,                         // server-returned paise value, never frontend total
  currency,
  order_id: razorpay_order_id,    // server-returned
  name: "MEI Bridal Couture",
  prefill: { name, email, contact: phone },
  theme: { color: "#c9a465" },

  handler: async (response) => {
    // Fires only on Razorpay payment SUCCESS
    // All identifiers from SDK callback only — never client-generated
    try {
      const result = await createOrder({
        customer: { name, email, phone, city },
        items: cartItems,
        shipping_address: { ... },
        payment: {
          provider: "razorpay",
          payment_id:  response.razorpay_payment_id,
          order_id:    response.razorpay_order_id,
          signature:   response.razorpay_signature,
        },
      });
      clearCart();                      // only after createOrder succeeds
      setOrderId(result.orderNumber);   // only after createOrder succeeds
    } catch (err) {
      // Payment succeeded but order creation failed
      setPaymentError(
        `Payment received but order creation failed. ` +
        `Please contact support with payment reference: ` +
        `${response.razorpay_payment_id} / ${response.razorpay_order_id}`
      );
      // cart NOT cleared — customer retains proof of payment
    } finally {
      setIsSubmitting(false);
    }
  },

  modal: {
    ondismiss: () => {
      // Customer closed the modal
      // Cart intact, form intact, no order created
      setIsSubmitting(false);
    },
  },

  "payment.failed": (response) => {
    // Razorpay signals payment failure
    // Cart intact, form intact, no order created
    setPaymentError("Payment failed. Please try again.");
    setIsSubmitting(false);
  },
}
```

`razorpay.open()` is called after the instance is created.

---

## Requirement Traceability

| # | Requirement | Implementation |
|---|---|---|
| 1 | Pay Now opens modal | `razorpay.open()` called after API succeeds and SDK instantiated |
| 2 | Dismiss → cart intact | `ondismiss` calls only `setIsSubmitting(false)` |
| 3 | Failed payment → cart intact | `payment.failed` sets error only, no `clearCart()` |
| 4 | `createOrder` called exactly once | Only inside `handler` (real) or bypass try-block; guarded by `if (isSubmitting) return` |
| 5 | Cart cleared only after order created | `clearCart()` follows `await createOrder()` in both paths |
| 6 | Confirmation only after order created | `setOrderId()` follows `clearCart()` in both paths |
| 7 | No refresh duplicates | `orderId` is ephemeral React state; refresh returns to empty checkout with cleared cart |
| 8 | UI unchanged | Only `handleSubmit` body + one `useEffect` + one state var + one error `<p>` added |
| 9 | Shipping logic unchanged | `calculateShipping` call untouched |
| 10 | Search/WhatsApp unaffected | No changes outside `page.tsx` |

---

## Safety Invariants

These must hold in every code path:

1. `createOrder()` is never called before Razorpay payment confirmation or bypass success.
2. `clearCart()` is never called unless `createOrder()` has resolved successfully.
3. `setOrderId()` is never called unless `createOrder()` has resolved successfully.
4. `setIsSubmitting(false)` is called on every exit path without exception.
5. Amount passed to Razorpay always comes from the server response, never from frontend state.
6. Payment identifiers passed to `createOrder()` always come from the Razorpay SDK callback, never client-generated (except in bypass mode where synthetic values are explicit).
7. Duplicate submission is blocked by `if (isSubmitting) return` at the top of `handleSubmit`.

---

## Error Messages

| Scenario | Message |
|---|---|
| `/api/razorpay/create-order` fails | "Unable to initiate payment. Please try again." |
| `window.Razorpay` not available | "Payment service unavailable. Please refresh and try again." |
| `payment.failed` | "Payment failed. Please try again." |
| `createOrder` fails (post-payment) | "Payment received but order creation failed. Please contact support with payment reference: {payment_id} / {order_id}" |
| `createOrder` fails (bypass) | "Order creation failed. Please try again." |

---

## Regression Constraints

Do not modify:
- `src/components/layout/Header.tsx`
- `src/app/layout.tsx`
- Any search functionality
- Any WhatsApp integration
- `src/lib/config/shipping.ts` or the `calculateShipping` call
- Any product pages
- Any cart store logic
- Any styling or class names
- Any existing checkout form fields or layout

---

## Verification Checklist

Implementation is not complete until every scenario passes:

- [ ] Pay Now opens Razorpay modal
- [ ] Payment success → `createOrder` called once → cart cleared → confirmation shown
- [ ] Payment failure → error shown → cart intact → form intact → loading reset
- [ ] Modal dismiss → cart intact → form intact → loading reset
- [ ] API failure → inline error → cart intact → form intact → loading reset
- [ ] Post-payment `createOrder` failure → payment-reference error shown → cart intact
- [ ] Duplicate Pay Now clicks do not open multiple modals or create multiple orders
- [ ] Bypass mode → skips modal → `createOrder` called once → confirmation shown
- [ ] Existing UI pixel-identical
- [ ] Shipping logic unchanged
- [ ] Search functionality unaffected
- [ ] WhatsApp functionality unaffected
- [ ] Existing tests pass (`src/lib/services/__tests__/orders.test.ts`)
