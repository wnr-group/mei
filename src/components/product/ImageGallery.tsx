"use client";

import { useState } from "react";
import Image from "next/image";
import type { StorefrontColor } from "@/types";

interface ImageGalleryProps {
  images: string[];
  coloredMedia?: { url: string; color_id: string | null }[];
  colors?: StorefrontColor[];
  selectedColorId?: string | null;
  onColorChange?: (colorId: string | null) => void;
}

const isSupabaseUrl = (url?: string | null) =>
  !!url &&
  url.startsWith("https://") &&
  url.includes(".supabase.co/storage/v1/object/public/");

export default function ImageGallery({
  images,
  coloredMedia,
  colors,
  selectedColorId,
  onColorChange,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Internal state used only when this component is not controlled from outside
  const [internalColorId, setInternalColorId] = useState<string | null>(null);

  const allImages = (images || []).filter(Boolean);

  if (allImages.length === 0) {
    return (
      <div className="relative aspect-[3/4] w-full bg-[#faf8f5] border border-[#e8e0d5]/40 flex items-center justify-center">
        <span className="text-[#9a9a9a] text-xs uppercase tracking-wider font-semibold select-none font-inter">
          No Image Available
        </span>
      </div>
    );
  }

  // When controlled from outside (ProductDetailBody), use selectedColorId; otherwise internal
  const isControlled = selectedColorId !== undefined;
  const activeColorId = isControlled ? selectedColorId : internalColorId;

  function handleColorClick(colorId: string | null) {
    if (isControlled) {
      onColorChange?.(colorId);
    } else {
      setInternalColorId(colorId);
    }
    setActiveIndex(0);
  }

  // Derive visible images based on active color filter
  const visibleImages =
    !activeColorId || !coloredMedia
      ? allImages
      : coloredMedia
          .filter(
            (m) => m.color_id === activeColorId || m.color_id === null
          )
          .map((m) => m.url)
          .filter(Boolean);

  const displayImages = visibleImages.length > 0 ? visibleImages : allImages;
  const safeIndex = activeIndex < displayImages.length ? activeIndex : 0;

  const hasColors = colors && colors.length > 0 && coloredMedia && coloredMedia.length > 0;

  const thumbnails = displayImages.slice(0, 4);
  const overflowCount = displayImages.length > 4 ? displayImages.length - 4 : 0;

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[3/4] w-full bg-[#faf8f5] border border-[#e8e0d5]/40">
        <Image
          src={displayImages[safeIndex]}
          alt="Product image"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          unoptimized={isSupabaseUrl(displayImages[safeIndex])}
        />
      </div>

      {/* Color Swatch Bar — only when colors exist */}
      {hasColors && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* "All" pill */}
          <button
            type="button"
            onClick={() => handleColorClick(null)}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all cursor-pointer ${
              activeColorId === null
                ? "border-[#c9a465] text-[#c9a465] bg-white"
                : "border-[#e8e0d5] text-[#9a9a9a] bg-white hover:border-[#c9a465]"
            }`}
          >
            All
          </button>

          {colors!.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => handleColorClick(color.id)}
              title={color.label}
              className={`w-7 h-7 border-2 transition-all cursor-pointer flex-shrink-0 ${
                activeColorId === color.id
                  ? "border-[#c9a465]"
                  : "border-transparent hover:border-[#c9a465]/50"
              }`}
            >
              {color.swatch_image_url ? (
                <Image
                  src={color.swatch_image_url}
                  alt={color.label}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                  unoptimized={isSupabaseUrl(color.swatch_image_url)}
                />
              ) : (
                <span
                  className="block w-full h-full"
                  style={{
                    backgroundColor: color.hex_code ?? "#e8e0d5",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Thumbnails Row */}
      <div className="grid grid-cols-4 gap-3">
        {thumbnails.map((url, idx) => (
          <button
            key={`${url}-${idx}`}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className={`relative h-20 border bg-white cursor-pointer transition-all duration-200 overflow-hidden ${
              safeIndex === idx
                ? "border-[#c9a465]"
                : "border-[#e8e0d5] hover:border-[#c9a465]"
            }`}
          >
            <Image
              src={url}
              alt={`View ${idx + 1}`}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={isSupabaseUrl(url)}
            />
            {/* +N overflow indicator on last slot */}
            {idx === 3 && overflowCount > 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-xs font-bold font-inter">
                  +{overflowCount}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
