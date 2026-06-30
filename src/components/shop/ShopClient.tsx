"use client";

import { useState, useMemo } from "react";
import type { Product } from "@/types";
import ProductCard from "@/components/shop/ProductCard";

interface ShopClientProps {
  products: Product[];
}

export default function ShopClient({ products }: ShopClientProps) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 8;

  // Dynamically derive unique work types from products
  const filters = useMemo(() => {
    const types = [...new Set(products.flatMap((p) => p.work_types ?? []))].sort();
    return ["ALL", ...types];
  }, [products]);

  // Filter products based on selected work type
  const filteredProducts = useMemo(() => {
    if (activeFilter === "ALL") return [...products];

    return products.filter((product) =>
      product.work_types?.includes(activeFilter)
    );
  }, [activeFilter, products]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  // Paginate filtered products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  // Show reset button only if there are products but current filter has none
  const showResetButton =
    products.length > 0 && filteredProducts.length === 0;

  return (
    <>
      {/* Filter Bar */}
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white font-inter select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Left Side: Filter Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition-all duration-300 border rounded-none cursor-pointer ${
                  activeFilter === filter
                    ? "bg-[#c9a465] text-white border-[#c9a465]"
                    : "bg-white text-[#4a4a4a] border-[#e8e0d5] hover:bg-[#faf8f5] hover:border-[#c9a465]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Right Side: Piece Count */}
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#9a9a9a]">
            {filteredProducts.length} Pieces
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {products.length === 0 ? (
          <div className="text-center py-20 space-y-4 font-inter">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9a9a9a]">
              No products available at the moment.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 space-y-4 font-inter">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9a9a9a]">
              No masterpieces match your selection.
            </p>
            {showResetButton && (
              <button
                onClick={() => handleFilterChange("ALL")}
                className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] hover:border-[#d4b87a] transition-all cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {paginatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-6 pt-16 text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a] font-inter select-none">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`transition-colors cursor-pointer ${
                currentPage === 1
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:text-[#c9a465]"
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
                    ? "text-[#1a1a1a] border-b-2 border-[#c9a465] pb-0.5"
                    : "hover:text-[#c9a465]"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`transition-colors cursor-pointer ${
                currentPage === totalPages
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:text-[#c9a465]"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
