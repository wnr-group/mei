"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

const isSupabaseUrl = (url?: string | null) => {
  return !!url && url.startsWith("https://") && url.includes(".supabase.co/storage/v1/object/public/");
};

export default function ProductCard({ product }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Format price helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="relative group flex flex-col space-y-2">

     

      {/* Gold Craft Badge (Top Left) */}
      <div className="absolute top-3 left-3 z-10 bg-[#c9a465] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest select-none shadow-sm">
        {product.work_types?.[0] ?? ""}
      </div>

      <Link href={`/shop/${product.slug}`} className="block w-full">
        {/* Product Image Wrapper */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#faf8f5] border border-[#e8e0d5]/40 flex items-center justify-center">
          {product.images?.[0] || product.image_url ? (
            <Image
              src={product.images[0] || product.image_url || ""}
              alt={product.name}
              fill
              sizes="(max-w-7xl) 20vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              unoptimized={isSupabaseUrl(product.images[0] || product.image_url)}
            />
          ) : (
            <span className="text-[#9a9a9a] text-[10px] uppercase tracking-wider font-semibold select-none">
              No Image
            </span>
          )}
          {/* Subtle Overlay on Hover */}
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Product Info */}
        <div className="space-y-1 pt-2 flex flex-col font-inter">
          <h3 className="text-sm font-semibold text-[#1a1a1a] group-hover:text-[#c9a465] transition-colors duration-300">
            {product.name}
          </h3>
          <p className="text-sm font-medium text-[#c9a465]">
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>
    </div>
  );
}
