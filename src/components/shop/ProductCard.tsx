"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

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
      {/* Wishlist Heart Icon (Top Right) */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsWishlisted(!isWishlisted);
        }}
        className="absolute top-3 right-3 z-10 p-1.5 bg-white/90 hover:bg-white rounded-full text-[#1a1a1a] shadow-sm hover:scale-105 transition-all duration-300 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill={isWishlisted ? "#c9a465" : "none"}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke={isWishlisted ? "#c9a465" : "currentColor"}
          className="w-4 h-4 transition-colors"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
          />
        </svg>
      </button>

      {/* Gold Craft Badge (Top Left) */}
      <div className="absolute top-3 left-3 z-10 bg-[#c9a465] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest select-none shadow-sm">
        {product.work_types?.[0] || "Custom Work"}
      </div>

      <Link href={`/shop/${product.category_id}/${product.slug}`} className="block w-full">
        {/* Product Image Wrapper */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#faf8f5] border border-[#e8e0d5]/40">
          <Image
            src={product.image_url || "/images/rose_lehenga.png"}
            alt={product.name}
            fill
            sizes="(max-w-7xl) 20vw, 50vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
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
