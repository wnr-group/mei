"use client";

import Link from "next/link";

export default function OrderError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Unable to Load Order
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          We couldn&apos;t retrieve your order details. Please try again.
        </p>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={unstable_retry}
            className="text-xs uppercase tracking-widest font-bold text-white bg-[#c9a465] px-6 py-2.5 hover:bg-[#d4b87a] transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/shop"
            className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
          >
            Back to Collection
          </Link>
        </div>
      </div>
    </main>
  );
}
