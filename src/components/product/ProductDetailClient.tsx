"use client";

import { useState } from "react";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import type { Product, StorefrontColor } from "@/types";

interface Props {
  product: Product;
  selectedColorId?: string | null;
  onColorChange?: (colorId: string | null) => void;
}

const isSupabaseUrl = (url?: string | null) =>
  !!url &&
  url.startsWith("https://") &&
  url.includes(".supabase.co/storage/v1/object/public/");

export default function ProductDetailClient({ product, selectedColorId, onColorChange }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const [colorError, setColorError] = useState(false);

  // Derive whether this exact product+color combination is already in the cart
  const isInCart = cartItems.some(
    (i) =>
      i.id === product.id &&
      (i.color_id ?? null) === (selectedColorId ?? null)
  );

  const hasColors = product.colors && product.colors.length > 0;
  const selectedColor: StorefrontColor | null = hasColors
    ? (product.colors.find((c) => c.id === selectedColorId) ?? null)
    : null;

  const handleAddToCart = () => {
    // If the product has colors, require a selection
    if (hasColors && !selectedColorId) {
      setColorError(true);
      return;
    }
    setColorError(false);

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] ?? product.image_url ?? "",
      work_types: product.work_types,
      color_id: selectedColorId ?? null,
      color_label: selectedColor?.label ?? null,
    });
  };

  return (
    <div className="space-y-4 pt-6">
      {/* Color variant selector */}
      {hasColors && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest font-bold text-[#1a1a1a]">
              Colour
            </span>
            {selectedColor && (
              <span className="text-xs font-medium text-[#4a4a4a]">
                {selectedColor.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((color) => {
              const isSelected = selectedColorId === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  onClick={() => {
                    onColorChange?.(color.id);
                    setColorError(false);
                  }}
                  className={`relative w-9 h-9 border-2 flex-shrink-0 transition-all cursor-pointer focus:outline-none ${
                    isSelected
                      ? "border-[#c9a465] shadow-[0_0_0_1px_#c9a465]"
                      : "border-transparent hover:border-[#c9a465]/60"
                  }`}
                >
                  {color.swatch_image_url ? (
                    <Image
                      src={color.swatch_image_url}
                      alt={color.label}
                      fill
                      className="object-cover"
                      unoptimized={isSupabaseUrl(color.swatch_image_url)}
                    />
                  ) : (
                    <span
                      className="block w-full h-full"
                      style={{ backgroundColor: color.hex_code ?? "#e8e0d5" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {colorError && (
            <p className="text-xs text-red-500 font-medium">
              Please select a colour before adding to cart.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleAddToCart}
        disabled={isInCart}
        className="w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer text-center disabled:opacity-70 disabled:cursor-default"
      >
        {isInCart ? "In Cart" : "Add to Cart"}
      </button>
      <a
        href={`https://wa.me/919876543210?text=Hi,%20I'm%20interested%20in%20inquiring%20about%20${encodeURIComponent(product.name)}${selectedColor ? `%20(${encodeURIComponent(selectedColor.label)})` : ""}.`}
        target="_blank"
        rel="noreferrer"
        className="w-full border border-[#25d366] text-[#25d366] hover:bg-[#25d366]/5 py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.982L2 22l5.233-1.371a9.994 9.994 0 0 0 4.779 1.209c5.505 0 9.988-4.479 9.99-9.987A9.994 9.994 0 0 0 12.012 2Zm4.877 14.224c-.274.773-1.332 1.396-1.84 1.442-.469.043-.918.23-2.986-.593-2.647-1.053-4.32-3.779-4.453-3.955-.13-.177-1.07-1.428-1.07-2.723 0-1.294.673-1.929.914-2.19.24-.262.529-.326.705-.326.177 0 .354.001.508.008.16.007.375-.06.586.447.218.522.747 1.821.811 1.952.064.13.107.283.02.457-.086.174-.13.283-.26.435-.13.153-.274.34-.39.457-.13.13-.267.272-.116.533.152.26.678 1.117 1.453 1.808.998.89 1.839 1.166 2.099 1.296.26.13.412.109.564-.065.152-.174.652-.761.826-1.022.174-.261.347-.217.585-.13.24.086 1.52.717 1.78.847.26.13.435.195.499.304.065.109.065.631-.208 1.405Z" />
        </svg>
        WhatsApp Inquiry
      </a>
    </div>
  );
}
