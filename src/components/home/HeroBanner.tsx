"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Banner } from "@/types";

const isSupabaseUrl = (url?: string | null) =>
  !!url && url.startsWith("https://") && url.includes(".supabase.co/storage/v1/object/public/");

interface Props {
  banners: Banner[];
}

const FALLBACK_IMAGE = "/images/hero_lehenga.png";
const FALLBACK_TITLE = "Handcrafted Elegance";
const FALLBACK_LINK = "/shop";
const AUTO_ADVANCE_MS = 5000;

export default function HeroBanner({ banners }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = banners.length;

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setCurrent((i) => (i - 1 + count) % count);
  }, [count]);

  // Auto-advance — reset timer when user manually navigates
  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(next, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [count, paused, next]);

  // Single static banner — no carousel chrome needed
  if (count === 0) {
    return (
      <section className="relative h-[85vh] w-full bg-[#1a1a1a] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src={FALLBACK_IMAGE}
            alt={FALLBACK_TITLE}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white space-y-6 font-inter">
          <h1 className="text-5xl sm:text-7xl font-light tracking-wide text-white leading-tight font-cormorant max-w-2xl">
            {FALLBACK_TITLE}
          </h1>
          <Link
            href={FALLBACK_LINK}
            className="inline-block hover:bg-[#d4b87a] text-white border border-[#c9a465] hover:border-[#d4b87a] px-8 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
          >
            Shop Collection
          </Link>
        </div>
      </section>
    );
  }

  const banner = banners[current];
  const image = banner.image_url || FALLBACK_IMAGE;
  const title = banner.title || FALLBACK_TITLE;
  const link = banner.link_url || FALLBACK_LINK;

  return (
    <section
      className="relative h-[85vh] w-full bg-[#1a1a1a] flex items-center overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides — stack all images, fade active one in */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          className={`absolute inset-0 z-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
        >
          <Image
            src={b.image_url || FALLBACK_IMAGE}
            alt={b.title}
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover object-center opacity-65"
            unoptimized={isSupabaseUrl(b.image_url)}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
      ))}

      {/* Text content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white space-y-6 font-inter">
        <h1 className="text-5xl sm:text-7xl font-light tracking-wide text-white leading-tight font-cormorant max-w-2xl transition-opacity duration-500">
          {title}
        </h1>
        <Link
          href={link}
          className="inline-block hover:bg-[#d4b87a] text-white border border-[#c9a465] hover:border-[#d4b87a] px-8 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
        >
          Shop Collection
        </Link>
      </div>

      {/* Prev / Next arrows — only when multiple banners */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => { prev(); setPaused(true); }}
            aria-label="Previous banner"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/60 text-white transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => { next(); setPaused(true); }}
            aria-label="Next banner"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/60 text-white transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {count > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setCurrent(i); setPaused(true); }}
              aria-label={`Go to slide ${i + 1}`}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "bg-[#c9a465] w-4"
                  : "bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
