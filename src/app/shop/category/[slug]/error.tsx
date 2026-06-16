// src/app/shop/category/[slug]/error.tsx
"use client";

import Link from "next/link";

export default function CategoryError() {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Category unavailable
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          This category couldn&apos;t be loaded. Please try browsing the full collection.
        </p>
        <Link
          href="/shop"
          className="inline-block text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
        >
          View Full Collection
        </Link>
      </div>
    </main>
  );
}
