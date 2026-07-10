// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getBanners } from "@/lib/services/banner";
import HeroBanner from "@/components/home/HeroBanner";


export const metadata: Metadata = {
  title: "MEI Bridal Couture — Handcrafted Elegance",
  description:
    "Premium Indian bridal wear — Lehengas, Sarees, and Bespoke Couture. Handcrafted with traditional Aari, Zardosi, and Mirror embroidery.",
};
import ProductCard from "@/components/shop/ProductCard";
import Button from "@/components/ui/Button";
import { getProducts } from "@/lib/services/products";
import { getCategories } from "@/lib/services/categories";

const isSupabaseUrl = (url?: string | null) => {
  return !!url && url.startsWith("https://") && url.includes(".supabase.co/storage/v1/object/public/");
};
 const crafts = [
  { label: "Aari Work", image: "/images/aariwork.jpg" },
  { label: "Zardosi", image: "/images/zardosi.webp" },
  { label: "Mirror Work", image: "/images/mirror.jpg" }, // Add your actual filenames
  { label: "Thread Embroidery", image: "/images/thread.jpg" },
  { label: "Cut Work", image: "/images/cut.webp" },
  { label: "Bespoke Tailoring", image: "/images/bespoke.jpg" },
];

export default async function Home() {
  const [categories, products,banners] = await Promise.all([
    getCategories(),
    getProducts({ limit: 8 }),
    getBanners()
  ]);

  return (
    <main className="flex-1 bg-white">
      {/* Hero Banner Carousel */}
      <HeroBanner banners={banners} />
      

      {/* Category Grid */}
      <section className="py-24 bg-white border-b border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Shop by Category
            </h2>
          </div>

          {categories.length === 0 ? (
            <p className="text-center text-sm text-[#9a9a9a] font-inter py-8">
              No categories available at the moment.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop/${cat.slug}`}
                  className="group relative h-96 w-full overflow-hidden border border-[#e8e0d5]/40"
                >
                  {cat.image_url ? (
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      fill
                      sizes="(max-width: 1280px) 33vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      unoptimized={isSupabaseUrl(cat.image_url)}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#a69c90] to-[#6b6460]" />
                  )}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-500 flex flex-col justify-end p-6 space-y-1.5 font-inter">
                    <span className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
                      {cat.subtitle}
                    </span>
                    <h3 className="text-xl font-light text-white uppercase tracking-wider font-cormorant">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-white/70 uppercase tracking-widest font-semibold border-b border-white/40 pb-1 w-max group-hover:border-white transition-colors duration-300">
                      Explore
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Pieces */}
      <section className="py-24 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Featured Pieces
            </h2>
            <Button variant="gold" size="sm">
              View All
            </Button>
          </div>

          {products.length === 0 ? (
            <p className="text-center text-sm text-[#9a9a9a] font-inter py-12">
              No products available at the moment.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 grid-rows-2 gap-8">
              {products.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          )}

          <div className="text-center pt-8">
            <Link
              href="/shop"
              className="inline-block border border-[#1a1a1a] px-8 py-3.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#1a1a1a] hover:text-white transition-colors duration-300 font-inter"
            >
              View Full Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Our Craft Section */}
      <section className="py-24 bg-white border-b border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Our Craft
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {crafts.map((craft, idx) => (
              <Link
                key={idx}
                href="/shop"
                className="group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden border border-[#e8e0d5]/10 bg-[#1a1a1a]"
              >
                {/* 1. The Actual Image Component */}
                {craft.image && (
                  <Image
                    src={craft.image}
                    alt={craft.label}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                )}

                {/* 2. Dark Overlay (Crucial so white text is readable over light images) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-90" />

                {/* 3. Text Label */}
                <div className="text-center z-10 transition-transform duration-500 group-hover:translate-y-[-4px]">
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
                    {craft.label}
                  </span>
                  <div className="w-0 h-[1px] bg-white/50 mx-auto mt-2 transition-all duration-500 group-hover:w-full" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bespoke Banner */}
      <section className="py-20 bg-[#faf8f5] text-center border-b border-[#e8e0d5]/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 font-inter">
          <h2 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Looking for Something Bespoke?
          </h2>
          <p className="text-sm sm:text-base text-[#4a4a4a] leading-relaxed max-w-lg mx-auto font-light">
            Work with our master artisans to create a one-of-a-kind masterpiece
            tailored to your vision and measurements.
          </p>
          <div className="pt-2">
            <Link
              href="/contact"
              className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 px-10 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
            >
              Get a Custom Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
