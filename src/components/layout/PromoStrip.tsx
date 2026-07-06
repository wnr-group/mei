"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
import {
  FREE_SHIPPING_THRESHOLD,
  getRemainingForFreeShipping,
} from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";

export default function PromoStrip({ defaultText }: { defaultText?: string }) {
  const total = useCartStore((state) => state.total);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const defaultMessage = defaultText ?? `Free Shipping on orders above ${formatCurrency(FREE_SHIPPING_THRESHOLD)}`;

  if (!mounted) {
    return (
      <div className="bg-[#c9a465] text-white text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center font-inter select-none">
        {defaultMessage}
      </div>
    );
  }

  const subtotal = total();
  const remaining = getRemainingForFreeShipping(subtotal);

  let message: string;
  if (subtotal === 0) {
    message = defaultMessage;
  } else if (remaining > 0) {
    message = `Add ${formatCurrency(remaining)} more to your order for free shipping`;
  } else {
    message = "You've unlocked free shipping on your order!";
  }

  return (
    <div className="bg-[#c9a465] text-white text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center font-inter select-none">
      {message}
    </div>
  );
}
