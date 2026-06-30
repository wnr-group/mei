# Razorpay Hosted Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock checkout flow in `src/app/checkout/page.tsx` with real Razorpay modal integration, ensuring payment is completed before order creation, cart is cleared only after order creation, and all failure paths preserve cart and form state.

**Architecture:** Single-file change. Add script loading on mount via `useEffect`. Add `paymentError` state and error display. Replace mock `handleSubmit` with four independent control flows (API error, SDK missing, bypass success, real Razorpay success/failure/dismiss) that converge on consistent cleanup: cart → order → confirmation, never before.

**Tech Stack:** React (hooks), TypeScript, Razorpay hosted checkout SDK, Supabase Edge Functions, Next.js API routes.

## Global Constraints

- Modify **only** `src/app/checkout/page.tsx`
- No new files, hooks, services, or architectural abstractions
- No changes to Header, Layout, shipping logic, search, WhatsApp, styling, form fields
- `createOrder()` called exactly once, only after payment success or bypass success
- `clearCart()` called only after `createOrder()` resolves successfully
- `setOrderId()` called only after `clearCart()`
- `setIsSubmitting(false)` on every exit path (API failure, SDK missing, payment.failed, ondismiss, createOrder failure, createOrder success)
- Payment amount always from server response, never frontend total
- Payment identifiers from Razorpay SDK callback only (except bypass with synthetic test values)
- `paymentError` cleared at start of each submission
- No duplicate submissions: `if (isSubmitting) return` at handleSubmit entry

---

## Task 1: Add Razorpay Script Loading

**Files:**
- Modify: `src/app/checkout/page.tsx:1-125` (add useEffect after imports, before component body)

**Interfaces:**
- Produces: `window.Razorpay` object available globally after mount (or `undefined` if load fails; handled in Task 3)

**Steps:**

- [ ] **Step 1: Add import for `useEffect`**

At line 3, update the import:

```typescript
import { useEffect, useState } from "react";
```

(It already imports `useState`; add `useEffect` if not present.)

- [ ] **Step 2: Add script-loading useEffect**

Inside `CheckoutPage()` component, after line 69 where `setMounted(true)` is set, add:

```typescript
  useEffect(() => {
    // Load Razorpay checkout script if not already present
    if (document.getElementById("razorpay-script")) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.id = "razorpay-script";
    script.async = true;
    document.body.appendChild(script);
  }, []);
```

- [ ] **Step 3: Verify script loads (manual check later)**

In Task 4, open browser dev tools and verify `window.Razorpay` is defined after the page loads.

- [ ] **Step 4: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat(checkout): add Razorpay script loading on mount"
```

---

## Task 2: Add `paymentError` State and Error Display

**Files:**
- Modify: `src/app/checkout/page.tsx:63-410` (add state, add error display JSX)

**Interfaces:**
- Consumes: Component's existing state setup (lines 49–64)
- Produces: `paymentError` state and setter; error message rendered below Pay Now button

**Steps:**

- [ ] **Step 1: Add `paymentError` state**

After line 64 where `const [isSubmitting, setIsSubmitting] = useState(false);` is defined, add:

```typescript
  const [paymentError, setPaymentError] = useState<string | null>(null);
```

- [ ] **Step 2: Add error display below Pay Now button**

Find the Pay Now button block (around line 372–409). After the closing `</button>` tag on line 405, before the "🔒 Secured by Razorpay" text (line 406), add:

```typescript
              {paymentError && (
                <p className="text-center text-xs text-red-500 font-inter mt-2">
                  {paymentError}
                </p>
              )}
```

The block should look like:

```typescript
            {/* Submit Button */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="..."
              >
                {isSubmitting ? (
                  <>
                    <svg className="..." />
                    Processing...
                  </>
                ) : (
                  `Pay Now — ${formatCurrency(grandTotal)}`
                )}
              </button>
              {paymentError && (
                <p className="text-center text-xs text-red-500 font-inter mt-2">
                  {paymentError}
                </p>
              )}
              <p className="text-center text-xs uppercase tracking-widest text-[#9a9a9a] font-bold select-none">
                🔒 Secured by Razorpay
              </p>
            </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat(checkout): add paymentError state and error display"
```

---

## Task 3: Replace Mock `handleSubmit` with Real Payment Flow

**Files:**
- Modify: `src/app/checkout/page.tsx:105–118` (replace entire handleSubmit function)

**Interfaces:**
- Consumes:
  - `validate()` (existing)
  - `formData` (existing state: name, email, phone, addressLine1, addressLine2, city, state, pincode, country)
  - `items` (from cart store)
  - `total()` (cart total function)
  - `clearCart()` (cart store)
  - `setOrderId()` (local state)
  - `setIsSubmitting()` (local state)
  - `setPaymentError()` (from Task 2)
  - `subtotalVal` (calculated from `total()`)
  - `calculateShipping()` (imported utility)
  - `createOrder()` from `@/lib/services/orders` — signature: `async (input: CreateOrderInput) => Promise<CreateOrderResult>` where `CreateOrderResult = { orderId, orderNumber, total }`
  - `/api/razorpay/create-order` — endpoint returns `{ razorpay_order_id, amount, currency, key_id, bypass? }`
  - `window.Razorpay` (from Task 1) — constructor and methods
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` env var (already in .env.local)
  - `NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS` env var (already in .env.local)

- Produces: Complete payment flow; either shows confirmation page (`setOrderId()` called) or keeps user on checkout with cart intact and error shown.

**Steps:**

- [ ] **Step 1: Replace handleSubmit entirely**

Delete lines 105–118 and replace with the complete function below.

Add these imports at the top of the file if not already present:

```typescript
import { createOrder } from "@/lib/services/orders";
```

Then replace `handleSubmit`:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard 1: Prevent duplicate submissions
    if (isSubmitting) return;

    // Guard 2: Validate form
    if (!validate()) return;

    // Guard 3: Clear previous error
    setPaymentError(null);
    setIsSubmitting(true);

    try {
      // Step 1: Request Razorpay order from backend (includes server-side price verification)
      const razorRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!razorRes.ok) {
        setPaymentError("Unable to initiate payment. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const razorData = await razorRes.json();
      const { razorpay_order_id, amount, currency, key_id, bypass } = razorData;

      // Step 2: Bypass mode — skip modal, call createOrder directly with synthetic payment data
      if (bypass === true) {
        try {
          const result = await createOrder({
            customer: {
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              city: formData.city,
            },
            items: items.map((item) => ({
              product_id: item.id,
              name: item.name,
              quantity: item.quantity,
            })),
            shipping_address: {
              addressLine1: formData.addressLine1,
              addressLine2: formData.addressLine2,
              city: formData.city,
              state: formData.state,
              pincode: formData.pincode,
              country: "India",
            },
            payment: {
              provider: "razorpay",
              payment_id: "bypass_pay_id",
              order_id: razorpay_order_id,
              signature: "bypass_sig",
            },
          });

          clearCart();
          setOrderId(result.orderNumber);
        } catch (err) {
          setPaymentError("Order creation failed. Please try again.");
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      // Step 3: Real Razorpay path — verify SDK is available
      if (!window.Razorpay) {
        setPaymentError("Payment service unavailable. Please refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      // Step 4: Create and open Razorpay modal
      const razorpay = new window.Razorpay({
        key: key_id,
        amount,
        currency,
        order_id: razorpay_order_id,
        name: "MEI Bridal Couture",
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#c9a465",
        },

        // Payment success handler
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // Create order after payment success
            const result = await createOrder({
              customer: {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                city: formData.city,
              },
              items: items.map((item) => ({
                product_id: item.id,
                name: item.name,
                quantity: item.quantity,
              })),
              shipping_address: {
                addressLine1: formData.addressLine1,
                addressLine2: formData.addressLine2,
                city: formData.city,
                state: formData.state,
                pincode: formData.pincode,
                country: "India",
              },
              payment: {
                provider: "razorpay",
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature,
              },
            });

            // Cart cleared only after successful order creation
            clearCart();
            setOrderId(result.orderNumber);
          } catch (err) {
            // Payment succeeded but order creation failed — preserve cart
            setPaymentError(
              `Payment received but order creation failed. ` +
              `Please contact support with payment reference: ` +
              `${response.razorpay_payment_id} / ${response.razorpay_order_id}`
            );
          } finally {
            setIsSubmitting(false);
          }
        },

        // Modal dismissed
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
          },
        },

        // Payment failed
        "payment.failed": () => {
          setPaymentError("Payment failed. Please try again.");
          setIsSubmitting(false);
        },
      });

      razorpay.open();
    } catch (err) {
      // Unexpected error (e.g., JSON parsing)
      setPaymentError("Unable to initiate payment. Please try again.");
      setIsSubmitting(false);
    }
  };
```

- [ ] **Step 2: Verify imports**

Ensure these imports exist at the top of the file:

```typescript
import { createOrder } from "@/lib/services/orders";
```

Check that `createOrder` is imported. If the file doesn't have this import, add it now.

- [ ] **Step 3: Check types**

The `window.Razorpay` call expects the response object in `handler` to have these properties:
- `razorpay_payment_id: string`
- `razorpay_order_id: string`
- `razorpay_signature: string`

These are provided by the Razorpay SDK. No type definition needed in this file; TypeScript will infer from usage.

- [ ] **Step 4: Run the app and test (manual, in Task 4)**

Start dev server and navigate to checkout page. Verify no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/checkout/page.tsx
git commit -m "feat(checkout): implement real Razorpay payment flow with all error paths"
```

---

## Task 4: Manual Verification of All Flows

**Files:**
- Test: Browser (manual UI testing)

**Interfaces:**
- Consumes: Running Next.js dev server with all infrastructure in place

**Steps:**

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000`

- [ ] **Step 2: Navigate to checkout page**

Go to `http://localhost:3000/shop`, add an item to cart, click "Checkout".

Expected: Checkout page loads with form fields and Pay Now button.

- [ ] **Step 3: Verify script loads**

Open browser DevTools → Console tab. Type:

```javascript
window.Razorpay
```

Expected: Should see the Razorpay constructor function (not `undefined`).

- [ ] **Step 4: Verify bypass mode (since NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true in .env.local)**

Fill all checkout form fields. Click Pay Now.

Expected:
- No Razorpay modal opens (bypass mode skips it)
- Order confirmation page appears after ~1–2 seconds
- Order reference shown (e.g., "Order Reference: #ORD-9042" or similar)
- Cart is now empty
- Refreshing the confirmation page keeps the confirmation page visible (refresh does not create duplicate orders; `orderId` state is preserved)

- [ ] **Step 5: Verify form validation**

Clear a required field (e.g., name). Click Pay Now.

Expected: Error message shown, button disabled, no submission attempt.

- [ ] **Step 6: Verify API error handling (mock)**

Disable NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS by editing `.env.local`:

```
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=false
```

Restart dev server. Fill form. Click Pay Now.

Expected:
- Razorpay modal attempts to open
- If credentials are invalid or network fails, error message appears: "Unable to initiate payment. Please try again."
- Cart remains intact
- Form values preserved
- Can retry

(Note: Credentials in `.env.local` are test keys; they may fail without network access. The error message handling is what's being verified here.)

- [ ] **Step 7: Return to bypass mode for further testing**

Re-enable bypass:

```
NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true
```

Restart dev server.

- [ ] **Step 8: Verify duplicate submission is blocked**

Fill form. Click Pay Now twice rapidly.

Expected: Only one order is created, only one confirmation page shown. Second click does nothing (handled by `if (isSubmitting) return` guard).

- [ ] **Step 9: Verify error message clears**

Fill form. Delete a required field. Click Pay Now.

Expected: Validation error shown.

Fill the field again. Click Pay Now.

Expected: Previous error message disappears; new submission attempt proceeds.

- [ ] **Step 10: Verify shipping logic unchanged**

Add items to cart that total less than ₹5000 (free shipping threshold).

Expected: Shipping cost shown on checkout page. On confirmation, order created successfully.

Add items totaling ₹5000+.

Expected: Shipping shown as "Free". On confirmation, order created successfully.

(The shipping logic is untouched in `handleSubmit`; just verify it still renders correctly on the summary.)

- [ ] **Step 11: Verify existing features unaffected**

- Header renders without errors
- Search still works (click a product link, search feature present)
- WhatsApp button visible and clickable
- Other pages accessible

- [ ] **Step 12: Check tests pass**

Run:

```bash
npm test -- src/lib/services/__tests__/orders.test.ts
```

Expected: All tests pass (5/5 or similar count depending on test suite).

- [ ] **Step 13: Final commit (verification complete)**

No code changes needed if all steps pass. Just document:

```bash
git log --oneline -5
```

Expected: Last 3–4 commits show the payment flow implementation.

---

## Verification Checklist

- [ ] Pay Now opens Razorpay modal (in real mode, not in bypass)
- [ ] Payment success → `createOrder` called once → cart cleared → confirmation shown
- [ ] Payment failure → error shown → cart intact → form intact → loading reset
- [ ] Modal dismiss → cart intact → form intact → loading reset
- [ ] API failure → inline error → cart intact → form intact → loading reset
- [ ] Post-payment `createOrder` failure → payment-reference error shown → cart intact
- [ ] Duplicate Pay Now clicks do not create duplicate orders
- [ ] Bypass mode → skips modal → `createOrder` called once → confirmation shown
- [ ] Form validation errors prevent submission
- [ ] Existing UI pixel-identical
- [ ] Shipping logic unchanged
- [ ] Search functionality unaffected
- [ ] WhatsApp functionality unaffected
- [ ] Existing tests pass
