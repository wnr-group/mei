"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { calculateShipping } from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";
import { createOrder } from "@/lib/services/orders";

const isSupabaseUrl = (url?: string | null) => {
  return !!url && url.startsWith("https://") && url.includes(".supabase.co/storage/v1/object/public/");
};

interface FormFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}

function FormField({ id, label, placeholder, value, error, onChange, type = "text" }: FormFieldProps) {
  return (
    <div className="w-full space-y-1">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
        {label}
      </label>
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full bg-transparent border-b pb-2 pt-1 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a]/40 focus:outline-none focus:border-[#c9a465] transition-all duration-300 rounded-none outline-none ${error ? "border-red-500 focus:border-red-500" : "border-[#e8e0d5]"
          }`}
      />
      {error && <p className="text-xs text-red-500 font-inter mt-0.5">{error}</p>}
    </div>
  );
}

export default function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const clearCart = useCartStore((state) => state.clearCart);

  const [mounted, setMounted] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [formData, setFormData] = useState({
    name: "Aarav Sharma",
    email: "aarav@example.com",
    phone: "+91 98765 43210",
    addressLine1: "",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // Load Razorpay checkout script if not already present
    const existingScript = document.getElementById("razorpay-script");
    if (existingScript) {
      // Script already loaded, check if Razorpay is available
      setScriptReady(!!(window as any).Razorpay);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.id = "razorpay-script";
    script.async = true;

    script.onload = () => {
      setScriptReady(true);
    };

    script.onerror = () => {
      setPaymentError("Failed to load Razorpay. Please refresh the page and try again.");
      setScriptReady(false);
    };

    document.body.appendChild(script);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = "Address is required";
    }
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.state.trim()) newErrors.state = "State is required";
    if (!formData.pincode.trim()) {
      newErrors.pincode = "Pincode is required";
    }
    if (!formData.country.trim()) newErrors.country = "Country is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;
    if (!validate()) return;
    setPaymentError(null);
    setIsSubmitting(true);

    try {
      // Step 1: Create Razorpay order via API (server-side price verification)
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!res.ok) {
        setPaymentError("Unable to initiate payment. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const { razorpay_order_id: order_id, amount, currency, key_id, bypass } = await res.json();

      // Step 2: Bypass mode (local development / payment bypass env flag)
      if (bypass) {
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
              country: formData.country,
            },
            payment: {
              provider: "razorpay",
              payment_id: "bypass_pay_id",
              order_id,
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

      // Step 3: SDK guard — ensure Razorpay JS is loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!scriptReady || !(window as any).Razorpay) {
        setPaymentError("Payment service is loading. Please wait a moment and try again.");
        setIsSubmitting(false);
        return;
      }

      // Step 4: Open Razorpay modal with success / failure / dismiss handlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const razorpay = new (window as any).Razorpay({
        key: key_id,
        amount,
        currency,
        order_id,
        name: "MEI Bridal Couture",
        prefill: { name: formData.name, email: formData.email, contact: formData.phone },
        theme: { color: "#c9a465" },

        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // Fires on payment SUCCESS only
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
                country: formData.country,
              },
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
            setPaymentError(
              `Payment received but order creation failed. ` +
                `Please contact support with payment reference: ` +
                `${response.razorpay_payment_id} / ${response.razorpay_order_id}`
            );
          } finally {
            setIsSubmitting(false);
          }
        },

        modal: {
          ondismiss: () => setIsSubmitting(false),
        },

        "payment.failed": () => {
          setPaymentError("Payment failed. Please try again.");
          setIsSubmitting(false);
        },
      });

      razorpay.open();
    } catch (err) {
      setPaymentError("Unable to initiate payment. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <main className="flex-1 bg-white min-h-[60vh] flex items-center justify-center font-inter">
        <p className="text-xs uppercase tracking-widest text-[#9a9a9a]">Loading Checkout...</p>
      </main>
    );
  }

  if (orderId) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh] bg-white">
        <div className="max-w-md w-full px-6 py-12 text-center space-y-6 border border-[#e8e0d5] bg-[#faf8f5] font-inter">
          <div className="w-16 h-16 bg-[#c9a465]/10 rounded-full flex items-center justify-center mx-auto text-[#c9a465]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
              Thank You for Your Order
            </h1>
            <p className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
              Order Reference: {orderId}
            </p>
            <p className="text-sm text-[#4a4a4a] leading-relaxed pt-2">
              Your handcrafted bridal piece is registered in our atelier systems. We will reach out to you within 24 hours to confirm your measurements and begin production.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/shop"
              className="inline-block bg-[#1a1a1a] text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#333333] transition-colors"
            >
              Continue Browsing
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const subtotalVal = total();
  const shipping = calculateShipping(subtotalVal);
  const grandTotal = subtotalVal + shipping;

  return (
    <main className="flex-1 bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Checkout
          </h1>
          {/* Steps */}
          <div className="flex justify-center items-center space-x-3 text-xs font-bold uppercase tracking-[0.2em] text-[#9a9a9a] font-inter">
            <span className="text-[#1a1a1a]">1 Contact</span>
            <span className="text-[#e8e0d5] font-light">—</span>
            <span>2 Shipping</span>
            <span className="text-[#e8e0d5] font-light">—</span>
            <span>3 Payment</span>
          </div>
        </div>

        {/* Checkout Form & Summary Grid */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start font-inter">
          {/* Left Column Forms */}
          <div className="lg:col-span-7 space-y-8">
            {/* Card 1: 01 Contact Details */}
            <div className="bg-white border border-[#e8e0d5] p-8 space-y-6">
              <h2 className="text-sm font-medium text-[#1a1a1a] tracking-wide select-none">
                01 Contact Details
              </h2>
              <div className="space-y-4">
                <FormField
                  id="name"
                  label="Full Name"
                  placeholder="Aarav Sharma"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    id="email"
                    label="Email Address"
                    type="email"
                    placeholder="aarav@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                  />
                  <FormField
                    id="phone"
                    label="Phone Number"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                    error={errors.phone}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: 02 Shipping Address */}
            <div className="bg-white border border-[#e8e0d5] p-8 space-y-6">
              <h2 className="text-sm font-medium text-[#1a1a1a] tracking-wide select-none">
                02 Shipping Address
              </h2>
              <div className="space-y-6">
                <FormField
                  id="addressLine1"
                  label="Address Line 1"
                  placeholder="Street name and house number"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  error={errors.addressLine1}
                />
                <FormField
                  id="addressLine2"
                  label="Address Line 2"
                  placeholder="Apartment, suite, unit (optional)"
                  value={formData.addressLine2}
                  onChange={handleChange}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    id="city"
                    label="City"
                    placeholder="Mumbai"
                    value={formData.city}
                    onChange={handleChange}
                    error={errors.city}
                  />
                  <FormField
                    id="state"
                    label="State"
                    placeholder="Maharashtra"
                    value={formData.state}
                    onChange={handleChange}
                    error={errors.state}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    id="pincode"
                    label="Pincode"
                    placeholder="400001"
                    value={formData.pincode}
                    onChange={handleChange}
                    error={errors.pincode}
                  />
                  <FormField
                    id="country"
                    label="Country"
                    placeholder="India"
                    value={formData.country}
                    onChange={handleChange}
                    error={errors.country}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column Summary */}
          <div className="lg:col-span-5 bg-[#faf8f5] border border-[#e8e0d5] p-8 space-y-6">
            <h2 className="text-sm font-medium text-[#1a1a1a] tracking-wide select-none">
              03 Order Summary
            </h2>

            {/* Cart Items list */}
            {items.length === 0 ? (
              <p className="text-xs text-[#9a9a9a]">No items in your cart.</p>
            ) : (
              <div className="space-y-6">
                {items.map((item) => (
                  <div key={item.id} className="flex space-x-4 items-center">
                    <div className="relative w-16 h-20 bg-white border border-[#e8e0d5]/40 flex-shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt="Product Thumbnail"
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={isSupabaseUrl(item.image)}
                        />
                      ) : (
                        <span className="text-[#9a9a9a] text-[8px] uppercase tracking-wider font-semibold select-none text-center px-1">
                          No Image
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-[#1a1a1a] leading-tight">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[#9a9a9a] uppercase tracking-wider font-medium">
                        QTY: {item.quantity}
                      </p>
                      <p className="text-xs font-semibold text-[#1a1a1a] pt-1">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <hr className="border-[#e8e0d5]" />

            {/* Calculations */}
            <div className="space-y-3 text-xs tracking-wide">
              <div className="flex justify-between text-[#4a4a4a] font-medium">
                <span className="uppercase text-xs tracking-widest font-bold">Subtotal</span>
                <span>{formatCurrency(subtotalVal)}</span>
              </div>
              <div className="flex justify-between text-[#4a4a4a] font-medium">
                <span className="uppercase text-xs tracking-widest font-bold">Shipping</span>
                {shipping === 0 ? (
                  <span className="text-[#c9a465] uppercase font-bold text-xs tracking-widest">Free</span>
                ) : (
                  <span className="font-bold text-xs text-[#1a1a1a]">{formatCurrency(shipping)}</span>
                )}
              </div>
            </div>

            <hr className="border-[#e8e0d5]" />

            {/* Total */}
            <div className="flex justify-between items-baseline select-none">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#1a1a1a]">
                Total
              </span>
              <span className="text-lg font-light text-[#1a1a1a]">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            {/* Submit Button */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-sm font-bold uppercase tracking-[0.2em] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
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
          </div>
        </form>
      </div>
    </main>
  );
}
