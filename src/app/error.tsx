// src/app/error.tsx
"use client";

interface Props {
  reset: () => void;
}

export default function RootError({ reset }: Props) {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Something went wrong
        </h2>
        <p className="text-sm text-[#9a9a9a] max-w-xs mx-auto">
          We&apos;re having trouble connecting to our servers. Please refresh the page.
        </p>
        <button
          onClick={reset}
          className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-3 px-8 text-xs font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
