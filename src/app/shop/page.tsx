"use client";

import { useState, useMemo } from "react";
import { MOCK_PRODUCTS } from "@/lib/data/mockProducts";
import ProductCard from "@/components/shop/ProductCard";

const CRAFT_FILTERS = [
  "ALL",
  "AARI WORK",
  "ZARDOSI",
  "MIRROR WORK",
  "THREAD EMBROIDERY",
  "CUT WORK",
];

export default function ShopPage() {
  const [activeFilter, setActiveFilter] = useState("ALL");

  // Filter products based on selected craft
  const filteredProducts = useMemo(() => {
    let result = [...MOCK_PRODUCTS];

    if (activeFilter === "ALL") {
      return result;
    }

    return result.filter((product) => {
      const craft = product.craftType.toLowerCase();
      
      if (activeFilter === "AARI WORK") {
        return craft.includes("aari");
      }
      if (activeFilter === "ZARDOSI") {
        return craft.includes("zardosi") || craft.includes("dabka");
      }
      if (activeFilter === "MIRROR WORK") {
        return craft.includes("mirror");
      }
      if (activeFilter === "THREAD EMBROIDERY") {
        return craft.includes("resham") || craft.includes("thread") || craft.includes("pita");
      }
      if (activeFilter === "CUT WORK") {
        return craft.includes("cut");
      }
      
      return true;
    });
  }, [activeFilter]);

  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* 1. Category Banner */}
      <div className="bg-[#a69c90] py-28 text-center select-none flex flex-col justify-center items-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#e5c185] mb-2 font-inter">
          BRIDAL MASTERPIECES
        </span>
        <h1 className="text-5xl font-light text-white font-cormorant italic select-none">
          Lehengas
        </h1>
      </div>

      {/* 2. Filter Bar */}
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white font-inter select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Left Side: Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {CRAFT_FILTERS.map((craft) => (
              <button
                key={craft}
                onClick={() => setActiveFilter(craft)}
                className={`px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] transition-all duration-300 border rounded-none cursor-pointer ${
                  activeFilter === craft
                    ? "bg-[#c9a465] text-white border-[#c9a465]"
                    : "bg-white text-[#4a4a4a] border-[#e8e0d5] hover:bg-[#faf8f5] hover:border-[#c9a465]"
                }`}
              >
                {craft}
              </button>
            ))}
          </div>

          {/* Right Side: Pieces Count */}
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9a9a9a]">
            {filteredProducts.length} Pieces
          </div>
        </div>
      </div>

      {/* 3. Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 space-y-4 font-inter">
            <p className="text-xs font-bold uppercase tracking-widest text-[#9a9a9a]">
              No masterpieces match your selections.
            </p>
            <button
              onClick={() => setActiveFilter("ALL")}
              className="text-[10px] uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] hover:border-[#d4b87a] transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* 4. Pagination */}
        <div className="flex justify-center items-center space-x-6 pt-16 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a9a9a] font-inter select-none">
          <button className="hover:text-[#c9a465] transition-colors cursor-pointer">Previous</button>
          <span className="text-[#1a1a1a] cursor-default">1</span>
          <button className="hover:text-[#c9a465] transition-colors cursor-pointer">2</button>
          <button className="hover:text-[#c9a465] transition-colors cursor-pointer">3</button>
          <span>...</span>
          <button className="hover:text-[#c9a465] transition-colors cursor-pointer">Next</button>
        </div>
      </div>
    </main>
  );
}
