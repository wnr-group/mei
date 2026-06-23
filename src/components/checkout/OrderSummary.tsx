"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
import { calculateShipping } from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";

export default function OrderSummary() {
  const items = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subtotalVal = total();
  const shipping = calculateShipping(subtotalVal);
  const estimatedTax = subtotalVal * 0.12; // 12% GST standard for luxury apparel in India
  const grandTotal = subtotalVal + shipping + estimatedTax;

  return (
    <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-6 font-inter">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#1a1a1a] border-b border-[#e8e0d5] pb-4">
        Order Summary
      </h2>

      {items.length === 0 ? (
        <p className="text-xs text-[#9a9a9a]">No items in your cart.</p>
      ) : (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-xs">
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-16 bg-white border border-[#e8e0d5]/40 flex-shrink-0">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-[#1a1a1a]">{item.name}</p>
                  <p className="text-[#9a9a9a] mt-0.5">Qty: {item.quantity}</p>
                </div>
              </div>
              <span className="font-semibold text-[#1a1a1a]">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      )}

      <hr className="border-[#e8e0d5]" />

      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-[#4a4a4a]">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotalVal)}</span>
        </div>
        <div className="flex justify-between text-[#4a4a4a]">
          <span>Estimated GST (12%)</span>
          <span>{formatCurrency(estimatedTax)}</span>
        </div>
        <div className="flex justify-between text-[#4a4a4a]">
          <span>Shipping</span>
          {shipping === 0 ? (
            <span className="text-[#c9a465] font-medium uppercase tracking-wider">Free</span>
          ) : (
            <span className="font-medium text-[#1a1a1a]">{formatCurrency(shipping)}</span>
          )}
        </div>
      </div>

      <hr className="border-[#e8e0d5]" />

      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#1a1a1a]">
          Total
        </span>
        <span className="text-lg font-light text-[#1a1a1a]">
          {formatCurrency(grandTotal)}
        </span>
      </div>
    </div>
  );
}
