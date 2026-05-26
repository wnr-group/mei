"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images || images.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Main Image View */}
      <div className="relative aspect-[3/4] w-full bg-[#faf8f5] border border-[#e8e0d5]/40">
        <Image
          src={images[activeIndex]}
          alt="Featured bridal lehenga main view"
          fill
          priority
          sizes="(max-w-7xl) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {/* Thumbnails Row below */}
      <div className="grid grid-cols-4 gap-4">
        {/* Thumbnail 1: Front view */}
        <button
          onClick={() => setActiveIndex(0)}
          className={`flex items-center justify-center sm:justify-start space-x-0 sm:space-x-2 p-1.5 sm:p-2 border bg-white cursor-pointer h-20 transition-all duration-300 ${
            activeIndex === 0 ? "border-[#c9a465]" : "border-[#e8e0d5] hover:border-[#c9a465]"
          }`}
        >
          <div className="relative w-10 h-14 flex-shrink-0 bg-[#faf8f5]">
            <Image
              src={images[0]}
              alt="Front view preview"
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold text-[#4a4a4a] text-left leading-tight">
            Front view
          </span>
        </button>

        {/* Thumbnail 2: Embroidery detail */}
        {images[1] ? (
          <button
            onClick={() => setActiveIndex(1)}
            className={`flex items-center justify-center sm:justify-start space-x-0 sm:space-x-2 p-1.5 sm:p-2 border bg-white cursor-pointer h-20 transition-all duration-300 ${
              activeIndex === 1 ? "border-[#c9a465]" : "border-[#e8e0d5] hover:border-[#c9a465]"
            }`}
          >
            <div className="relative w-10 h-14 flex-shrink-0 bg-[#faf8f5]">
              <Image
                src={images[1]}
                alt="Embroidery detail preview"
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <span className="hidden sm:inline-block text-[8px] sm:text-[9px] uppercase tracking-wider font-semibold text-[#4a4a4a] text-left leading-tight">
              Embroidery detail
            </span>
          </button>
        ) : (
          <div className="bg-[#faf8f5] border border-[#e8e0d5]/40 h-20" />
        )}

        {/* Thumbnail 3: Grey Placeholder */}
        <div className="bg-[#faf8f5] border border-[#e8e0d5]/40 h-20" />

        {/* Thumbnail 4: Grey Placeholder */}
        <div className="bg-[#faf8f5] border border-[#e8e0d5]/40 h-20" />
      </div>
    </div>
  );
}
