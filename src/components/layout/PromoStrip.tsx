"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart";
// FREE_SHIPPING_THRESHOLD is used as a loading-state fallback only.
// The live threshold is fetched from /api/shipping/settings (which reads
// the shipping_settings table) so Admin changes are reflected here.
import { FREE_SHIPPING_THRESHOLD } from "@/lib/config/shipping";
import { formatCurrency } from "@/lib/utils/format";

export default function PromoStrip({ defaultText }: { defaultText?: string }) {
  const total = useCartStore((state) => state.total);
  const [mounted, setMounted] = useState(false);
  const [threshold, setThreshold] = useState<number>(FREE_SHIPPING_THRESHOLD);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // Fetch live threshold from DB — falls back to hardcoded constant if unavailable
    fetch("/api/shipping/settings")
      .then((r) => r.json())
      .then((data) => {
        if (
          data.freeShippingEnabled &&
          typeof data.freeShippingThreshold === "number"
        ) {
          setThreshold(data.freeShippingThreshold);
        }
      })
      .catch(() => {
        // Silently retain hardcoded fallback — promo strip is display-only
      });
  }, []);

  const defaultMessage =
    defaultText ?? `Free Shipping on orders above ${formatCurrency(threshold)}`;

  if (!mounted) {
    return (
      <div className="bg-[#c9a465] text-white text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center font-inter select-none">
        {defaultMessage}
      </div>
    );
  }

  const subtotal = total();
  const remaining = Math.max(threshold - subtotal, 0);

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
