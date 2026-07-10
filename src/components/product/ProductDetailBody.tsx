"use client";

import { useState } from "react";
import type { Product } from "@/types";
import ImageGallery from "./ImageGallery";
import ProductDetailClient from "./ProductDetailClient";

interface Props {
  product: Product;
}

export default function ProductDetailBody({ product }: Props) {
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div>
        <ImageGallery
          images={product.images}
          coloredMedia={product.coloredMedia}
          colors={product.colors}
          selectedColorId={selectedColorId}
          onColorChange={setSelectedColorId}
        />
      </div>
      <div className="space-y-8 font-inter">
        {/* Static product info — rendered here so it stays SSR-friendly text */}
        <div className="space-y-3">
          <span className="text-xs uppercase tracking-widest text-[#9a9a9a] font-medium block">
            {product.category?.name ?? ""}
          </span>
          <h1 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            {product.name}
          </h1>
          <p className="text-xl font-light text-[#1a1a1a] tracking-wide">
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(product.price)}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[#4a4a4a] leading-relaxed font-light">
            {product.description}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {product.work_types?.map((type) => (
              <span
                key={type}
                className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none"
              >
                {type}
              </span>
            ))}
            <span className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
              Hand-Embroidered
            </span>
          </div>
        </div>

        <ProductDetailClient
          product={product}
          selectedColorId={selectedColorId}
          onColorChange={setSelectedColorId}
        />
      </div>
    </div>
  );
}
