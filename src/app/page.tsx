// src/app/page.tsx
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/shop/ProductCard";
import Button from "@/components/ui/Button";
import { getProducts } from "@/lib/services/products";
import { getCategories } from "@/lib/services/categories";

export default async function Home() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ limit: 8 }),
  ]);

  return (
    <main className="flex-1 bg-white">
      {/* Hero Banner */}
      <section className="relative h-[85vh] w-full bg-[#1a1a1a] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero_lehenga.png"
            alt="MEI Bridal Couture Hero Backdrop"
            fill
            priority
            sizes="100vw"
            className="object-cover object-top opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white space-y-6 font-inter">
          <h1 className="text-5xl sm:text-7xl font-light tracking-wide text-white leading-tight font-cormorant max-w-2xl animate-fadeIn">
            Handcrafted Elegance
          </h1>
          <div className="flex flex-wrap gap-4 pt-4 animate-fadeIn items-center justify-center">
            <Link
              href="/shop"
              className="hover:bg-[#d4b87a] text-white border border-[#c9a465] hover:border-[#d4b87a] px-8 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
            >
              Shop Collection
            </Link>
          </div>
        </div>
      </section>

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
                  href={`/shop/category/${cat.slug}`}
                  className="group relative h-96 w-full overflow-hidden border border-[#e8e0d5]/40"
                >
                  <Image
                    src={cat.image_url ?? "/images/rose_lehenga.png"}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 1280px) 33vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
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
            <Button variant="gold" size="sm">View All</Button>
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
            {[
              { label: "Aari Work", bg: "bg-[#3a3a3a]" },
              { label: "Zardosi", bg: "bg-[#4a4a4a]" },
              { label: "Mirror Work", bg: "bg-[#5a5a5a]" },
              { label: "Thread Embroidery", bg: "bg-[#6a6a6a]" },
              { label: "Cut Work", bg: "bg-[#7a7a7a]" },
              { label: "Bespoke Tailoring", bg: "bg-[#2d2d2d]" },
            ].map((craft, idx) => (
              <Link
                key={idx}
                href="/shop"
                className={`group relative aspect-square w-full flex items-end justify-center pb-8 ${craft.bg} hover:brightness-110 transition-all duration-500 hover:scale-[1.01] overflow-hidden border border-[#e8e0d5]/10`}
              >
                <div className="text-center z-10">
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
                    {craft.label}
                  </span>
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
            Work with our master artisans to create a one-of-a-kind masterpiece tailored to your vision and measurements.
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
