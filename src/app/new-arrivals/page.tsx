import { getProducts } from "@/lib/services/products";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";

interface NewArrivalsPageProps {
  searchParams: Promise<{ page?: string }> | { page?: string };
}

export default async function NewArrivalsPage({ searchParams }: NewArrivalsPageProps) {
  const resolvedParams = await searchParams;
  const currentPage = Number(resolvedParams.page) || 1;
  const limit = 12;

  // 1. Fetch paginated products for the current page
  const newArrivals = await getProducts({
    limit,
    page: currentPage,
    isNewArrival: true,
  });

  // 2. Fetch all new arrivals to determine total pages
  const allNewArrivals = await getProducts({
    isNewArrival: true,
  });

  const totalProducts = allNewArrivals.length;
  const totalPages = Math.ceil(totalProducts / limit);

  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* Hero Banner */}
      <section className="bg-[#1a1a1a] py-32 text-center select-none relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#c9a465]/5 to-transparent" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 space-y-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a465] font-inter">
            Season 2026
          </span>
          <h1 className="text-5xl sm:text-6xl font-light text-white font-cormorant tracking-wide">
            New Arrivals
          </h1>
          <p className="text-sm text-white/60 font-inter font-light leading-relaxed max-w-md mx-auto">
            The latest masterpieces from our atelier — each piece a testament to centuries-old craft meeting contemporary vision.
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {newArrivals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-sm text-[#4a4a4a] font-inter font-light">
            No new arrivals found at the moment.
          </div>
        )}
      </section>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <section className="flex justify-center items-center space-x-6 pb-20 font-inter">
          <Link
            href={`/new-arrivals?page=${currentPage - 1}`}
            className={`px-4 py-2 border border-[#1a1a1a] text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
              currentPage <= 1
                ? "opacity-30 cursor-not-allowed pointer-events-none"
                : "hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            Prev
          </Link>
          <span className="text-xs uppercase tracking-widest text-[#4a4a4a] select-none">
            Page {currentPage} of {totalPages}
          </span>
          <Link
            href={`/new-arrivals?page=${currentPage + 1}`}
            className={`px-4 py-2 border border-[#1a1a1a] text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
              currentPage >= totalPages
                ? "opacity-30 cursor-not-allowed pointer-events-none"
                : "hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            Next
          </Link>
        </section>
      )}

      {/* Editorial Strip */}
      <section className="border-t border-b border-[#e8e0d5]/40 bg-[#faf8f5] py-20">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Crafted for the Modern Bride
          </h2>
          <p className="text-sm text-[#4a4a4a] leading-relaxed font-inter font-light max-w-xl mx-auto">
            Every new arrival is born from a dialogue between our senior designers and the brides they serve — silhouettes refined through consultations, embroidery motifs drawn from personal stories, and fabrics sourced from the finest Indian mills.
          </p>
          <div className="pt-4">
            <Link
              href="/contact"
              className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-3.5 px-10 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 font-inter"
            >
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>

      {/* Full Collection CTA */}
      <section className="py-20 text-center">
        <Link
          href="/shop"
          className="inline-block border border-[#1a1a1a] px-8 py-3.5 text-sm font-semibold uppercase tracking-widest hover:bg-[#1a1a1a] hover:text-white transition-colors duration-300 font-inter"
        >
          View Full Collection
        </Link>
      </section>
    </main>
  );
}
