"use client";

import { MOCK_PRODUCTS } from "@/lib/data/mockProducts";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";

export default function NewArrivalsPage() {
  const newArrivals = MOCK_PRODUCTS.slice(0, 4);

  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* Hero Banner */}
      <section className="bg-[#1a1a1a] py-32 text-center select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#c9a465]/5 to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 space-y-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a465] font-inter">
            Season 2026
          </span>
          <h1 className="text-5xl sm:text-6xl font-light text-white font-cormorant tracking-wide">
            New Arrivals
          </h1>
          <p className="text-sm text-white/60 font-inter font-light leading-relaxed max-w-md mx-auto">
            The latest masterpieces from our atelier — each piece a testament to centuries-old craft meeting contemporary vision.
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Editorial Strip */}
      <section className="border-t border-b border-[#e8e0d5]/40 bg-[#faf8f5] py-20">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Crafted for the Modern Bride
          </h2>
          <p className="text-sm text-[#4a4a4a] leading-relaxed font-inter font-light max-w-xl mx-auto">
            Every new arrival is born from a dialogue between our senior designers and the brides they serve — silhouettes refined through consultations, embroidery motifs drawn from personal stories, and fabrics sourced from the finest Indian mills.
          </p>
          <div className="pt-4">
            <Link
              href="/contact"
              className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-3.5 px-10 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 font-inter"
            >
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>

      {/* Full Collection CTA */}
      <section className="py-20 text-center">
        <Link
          href="/shop"
          className="inline-block border border-[#1a1a1a] px-8 py-3.5 text-sm font-semibold uppercase tracking-widest hover:bg-[#1a1a1a] hover:text-white transition-colors duration-300 font-inter"
        >
          View Full Collection
        </Link>
      </section>
    </main>
  );
}
