"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const isSupabaseUrl = (url?: string | null) => {
  return !!url && url.startsWith("https://") && url.includes(".supabase.co/storage/v1/object/public/");
};
import { useCartStore } from "@/store/cart";
// Shipping is state-dependent and resolved at checkout via /api/shipping/rate.
import { formatCurrency } from "@/lib/utils/format";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const total = useCartStore((state) => state.total);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const subtotal = total();

  if (!mounted) {
    return (
      <main className="flex-1 bg-white min-h-[60vh] flex items-center justify-center font-inter">
        <p className="text-xs uppercase tracking-widest text-[#9a9a9a]">Loading Cart...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Title */}
        <div className="border-b border-[#e8e0d5]/40 pb-6">
          <h1 className="text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Your Cart
          </h1>
          <p className="text-sm text-[#9a9a9a] uppercase tracking-wider mt-1 font-inter">
            {items.length === 1 ? "1 Item" : `${items.length} items`} 
          </p>
        </div>

        {items.length === 0 ? (
          <div className="py-20 text-center space-y-6 max-w-md mx-auto font-inter">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
              className="w-16 h-16 text-[#9a9a9a] mx-auto"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <div className="space-y-1">
              <h2 className="text-sm font-medium uppercase tracking-wider text-[#1a1a1a]">
                Your Cart is Empty
              </h2>
              <p className="text-sm text-[#9a9a9a]">
                Add handcrafted couture lehengas or sarees from our catalogs.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-block bg-[#1a1a1a] hover:bg-[#333333] text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
            >
              Explore Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
            {/* Items Column */}
            <div className="lg:col-span-8 space-y-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#e8e0d5]/40 pb-6 gap-6 font-inter"
                >
                  <div className="flex items-center space-x-6">
                    {/* Item Image */}
                    <div className="relative w-24 h-32 bg-[#faf8f5] flex-shrink-0 border border-[#e8e0d5]/40 flex items-center justify-center">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                          unoptimized={isSupabaseUrl(item.image)}
                        />
                      ) : (
                        <span className="text-[#9a9a9a] text-[10px] uppercase tracking-wider font-semibold select-none">
                          No Image
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
                        {item.work_types?.[0] ?? ""}
                      </span>
                      <h3 className="text-base font-light text-[#1a1a1a] font-inter">
                        {item.name}
                      </h3>
                      <p className="text-sm font-light text-[#1a1a1a]">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>

                  {/* Quantity and Actions Wrapper */}
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-8">
                    {/* Quantity Selector */}
                    <div className="flex items-center border border-[#e8e0d5] bg-[#faf8f5]">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-3.5 py-1.5 text-[#1a1a1a] hover:text-[#c9a465] transition-colors cursor-pointer text-sm"
                      >
                        -
                      </button>
                      <span className="px-4 text-xs font-semibold text-[#1a1a1a]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-3.5 py-1.5 text-[#1a1a1a] hover:text-[#c9a465] transition-colors cursor-pointer text-sm"
                      >
                        +
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-sm uppercase tracking-widest font-medium text-[#9a9a9a] hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary Column */}
            <div className="lg:col-span-4 bg-[#faf8f5] border border-[#e8e0d5] p-8 space-y-6 font-inter">
              <h2 className="text-1.5xl font-cormorant font-bold tracking-widest text-[#1a1a1a] border-b border-[#e8e0d5] pb-4">
                Order Summary
              </h2>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-[#4a4a4a]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#1a1a1a]">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-[#4a4a4a]">
                  <span>Shipping</span>
                  <span className="text-[#9a9a9a] text-xs">Calculated at checkout</span>
                </div>
              </div>

              <hr className="border-[#e8e0d5]" />

              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold uppercase tracking-widest text-[#1a1a1a]">
                  Subtotal
                </span>
                <span className="text-xl font-inter font-bold text-[#c9a465]">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href="/checkout"
                  className="block w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-sm font-semibold uppercase tracking-widest text-center transition-colors duration-300"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href="/shop"
                  className="block text-center text-sm uppercase tracking-widest text-[#9a9a9a] hover:text-[#c9a465] transition-colors duration-300 font-semibold"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
