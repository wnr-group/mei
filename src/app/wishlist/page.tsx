"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWishlistStore } from "@/store/wishlist";
import ProductCard from "@/components/shop/ProductCard";

export default function WishlistPage() {
  const items = useWishlistStore((state) => state.items);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="flex-1 bg-white min-h-[60vh] flex items-center justify-center font-inter">
        <p className="text-xs uppercase tracking-widest text-[#9a9a9a]">Loading Wishlist...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Title */}
        <div className="border-b border-[#e8e0d5]/40 pb-6">
          <h1 className="text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Your Wishlist
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
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
            <div className="space-y-1">
              <h2 className="text-sm font-medium uppercase tracking-wider text-[#1a1a1a]">
                Your Wishlist is Empty
              </h2>
              <p className="text-sm text-[#9a9a9a]">
                Save handcrafted couture lehengas or sarees you love for later.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-block bg-[#1a1a1a] hover:bg-[#333333] text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
            >
              Discover the Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}