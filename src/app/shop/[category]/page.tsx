"use client";

import { useState, useMemo, use } from "react";
import { notFound } from "next/navigation";
import { MOCK_CATEGORIES, MOCK_PRODUCTS } from "@/lib/data/mockProducts";
import ProductCard from "@/components/shop/ProductCard";

const CRAFT_FILTERS = [
  "ALL",
  "Aari",
  "Zardosi",
  "Mirror",
  "Thread",
  "Cut",
  "Tailoring",
  "Kundan",
];

const ITEMS_PER_PAGE = 8;

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { category } = use(params);

  // Validate category slug
  const categoryData = useMemo(() => {
    return MOCK_CATEGORIES.find((cat) => cat.slug === category);
  }, [category]);

  if (!categoryData) {
    notFound();
  }

  const [activeFilter, setActiveFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter products by category first
  const categoryProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter((product) => product.category_id === categoryData.id);
  }, [categoryData.id]);

  // Filter products by craft type
  const filteredProducts = useMemo(() => {
    const result = [...categoryProducts];

    // Reset pagination to first page on filter change
    // This is handled reactively by resetting currentPage when activeFilter changes
    
    if (activeFilter === "ALL") {
      return result;
    }
    
    const lowerFilter = activeFilter.toLowerCase();

    return result.filter((product) => {
      if (!product.work_types) return false;
      return product.work_types.some((wt) => {
        const lowerWt = wt.toLowerCase();
        if (lowerFilter === "aari") {
          return lowerWt.includes("aari");
        }
        if (lowerFilter === "zardosi") {
          return lowerWt.includes("zardosi") || lowerWt.includes("dabka");
        }
        if (lowerFilter === "mirror") {
          return lowerWt.includes("mirror");
        }
        if (lowerFilter === "thread") {
          return lowerWt.includes("resham") || lowerWt.includes("thread") || lowerWt.includes("pita");
        }
        if (lowerFilter === "cut") {
          return lowerWt.includes("cut");
        }
        if (lowerFilter === "tailoring") {
          return lowerWt.includes("tailor") || lowerWt.includes("bespoke") || lowerWt.includes("fit");
        }
        if (lowerFilter === "kundan") {
          return lowerWt.includes("kundan") || lowerWt.includes("stone") || lowerWt.includes("jewel") || lowerWt.includes("pearl");
        }
        return false;
      });
    });
  }, [categoryProducts, activeFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const showPagination = totalPages > 1;

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* 1. Category Banner */}
      <div className="bg-[#a69c90] py-8 text-center select-none flex flex-col justify-center items-center px-4">
        
        <h1 className="text-5xl font-light text-white font-cormorant italic select-none uppercase tracking-wide">
          {categoryData.name}
        </h1>
        {categoryData.description && (
          <p className="text-sm text-white/90 font-light mt-4 max-w-xl text-center font-inter leading-relaxed">
            {categoryData.description}
          </p>
        )}
      </div>

      {/* 2. Filter Bar */}
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white font-inter select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Left Side: Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {CRAFT_FILTERS.map((craft) => (
              <button
                key={craft}
                onClick={() => {
                  setActiveFilter(craft);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition-all duration-300 border rounded-none cursor-pointer ${
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
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#9a9a9a]">
            {filteredProducts.length} {filteredProducts.length === 1 ? "Piece" : "Pieces"}
          </div>
        </div>
      </div>

      {/* 3. Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {paginatedProducts.length === 0 ? (
          <div className="text-center py-20 space-y-4 font-inter">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9a9a9a]">
              No masterpieces match your selections.
            </p>
            <button
              onClick={() => {
                setActiveFilter("ALL");
                setCurrentPage(1);
              }}
              className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] hover:border-[#d4b87a] transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* 4. Pagination */}
        {showPagination && (
          <div className="flex justify-center items-center space-x-6 pt-16 text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a] font-inter select-none">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`transition-colors cursor-pointer ${
                currentPage === 1 ? "opacity-30 cursor-not-allowed" : "hover:text-[#c9a465]"
              }`}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`transition-colors cursor-pointer ${
                  currentPage === page
                    ? "text-[#1a1a1a] cursor-default font-black"
                    : "hover:text-[#c9a465]"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`transition-colors cursor-pointer ${
                currentPage === totalPages ? "opacity-30 cursor-not-allowed" : "hover:text-[#c9a465]"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
