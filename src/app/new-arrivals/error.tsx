// src/app/new-arrivals/error.tsx
"use client";

interface Props {
  reset: () => void;
}

export default function NewArrivalsError({ reset }: Props) {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Something went wrong
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          We couldn&apos;t load the new arrivals. Please try again.
        </p>
        <button
          onClick={reset}
          className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
