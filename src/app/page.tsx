// src/app/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getBanners } from "@/lib/services/banner";
import HeroBanner from "@/components/home/HeroBanner";


export const metadata: Metadata = {
  title: "MEI Bridal Couture — Handcrafted Lehengas & Bridal Sarees",
  description:
    "Premium Indian bridal wear — Lehengas, Sarees, and Bespoke Couture. Handcrafted with traditional Aari, Zardosi, and Mirror embroidery.",
  alternates: { canonical: "/" },
};
import ProductCard from "@/components/shop/ProductCard";
import Button from "@/components/ui/Button";
import { getProducts } from "@/lib/services/products";
import { getCategories } from "@/lib/services/categories";
import EnhancedCraftsGridContainer from "@/components/features/crafts-v2/EnhancedCraftsGridContainer";

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
    getProducts({ limit: 8, isFeatured: true }),
    getBanners()
  ]);

  return (
    <main className="flex-1 bg-white">
      {/* Hero Banner Carousel */}
      <HeroBanner banners={banners} />
      

      {/* Category Grid */}
      <section className="py-24 bg-white border-b border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Shop by Category
            </h2>
            <p className="text-sm sm:text-base text-[#4a4a4a] leading-relaxed font-inter font-light">
              From heirloom bridal lehengas to hand-embroidered sarees and reception
              gowns, every MEI collection is designed for the modern Indian bride who
              values heritage craftsmanship. Explore our curated categories to find
              the silhouette that carries your story down the aisle.
            </p>
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
            <Link href="/shop">
              <Button variant="gold" size="sm">
                View All
              </Button>
            </Link>
          </div>

          {products.length === 0 ? (
            <p className="text-center text-sm text-[#9a9a9a] font-inter py-12">
              No products available at the moment.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Our Craft
            </h2>
            <p className="text-sm sm:text-base text-[#4a4a4a] leading-relaxed font-inter font-light">
              Each garment is brought to life in our atelier by master artisans who
              have spent decades perfecting traditional Indian embroidery. Aari,
              Zardosi, mirror work, thread embroidery, and intricate cut work are
              layered by hand over weeks of patient labour — techniques passed down
              through generations and reimagined for contemporary brides.
            </p>
          </div>

          <EnhancedCraftsGridContainer mode="minimal" items={crafts} />
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
