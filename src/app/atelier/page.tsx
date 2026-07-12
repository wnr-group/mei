import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Atelier — Our Story & Craftsmanship",
  description:
    "Discover the heritage behind MEI Bridal Couture. Learn about our master karigars and traditional embroidery techniques like Zardosi, Aari, and Mirror work.",
  alternates: { canonical: "/atelier" },
};

export default function AtelierPage() {
  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* Hero */}
      <section className="relative h-[70vh] w-full bg-[#1a1a1a] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero_lehenga.png"
            alt="MEI Atelier workspace"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-[#1a1a1a]/60" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a465] font-inter">
            Our Story
          </span>
          <h1 className="text-5xl sm:text-6xl font-light text-white font-cormorant tracking-wide">
            The Atelier
          </h1>
          <p className="text-sm text-white/60 font-inter font-light leading-relaxed max-w-lg mx-auto">
            Where heritage meets couture — a space dedicated to preserving centuries-old Indian embroidery through bespoke bridal wear.
          </p>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a465] font-inter">
                Philosophy
              </span>
              <h2 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
                Every Stitch Tells a Story
              </h2>
              <p className="text-sm text-[#4a4a4a] leading-relaxed font-inter font-light">
                MEI Bridal Couture was founded on a singular belief: that the artistry of Indian hand-embroidery deserves to flourish in the modern world. Our atelier brings together master karigars — some with over three decades of experience — to create bridal pieces that are as much works of art as they are garments.
              </p>
              <p className="text-sm text-[#4a4a4a] leading-relaxed font-inter font-light">
                Each lehenga begins as a sketch informed by personal consultations. From there, our artisans select fabrics, develop custom colour palettes, and meticulously embroider every motif by hand — a process that can take 200 to 600 hours per piece.
              </p>
            </div>
            <div className="relative aspect-[4/5] w-full border border-[#e8e0d5]/40 overflow-hidden">
              <Image
                src="/images/rose_lehenga.png"
                alt="Intricate hand embroidery close-up"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Craft Pillars */}
      <section className="py-24 bg-[#faf8f5] border-t border-b border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a465] font-inter">
              Our Craft
            </span>
            <h2 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
              Techniques Preserved Through Generations
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                title: "Zardosi & Dabka",
                description:
                  "Metallic thread embroidery originating from the Mughal courts, using gold and silver bullion wire twisted into elaborate floral and geometric patterns.",
              },
              {
                title: "Aari Work",
                description:
                  "A chain-stitch technique done with a hooked needle, allowing artisans to create flowing curves and intricate fills that are impossible with conventional embroidery.",
              },
              {
                title: "Mirror & Resham",
                description:
                  "Hand-placed reflective embellishments secured with silk thread, creating pieces that catch light from every angle — a hallmark of Rajasthani bridal traditions.",
              },
            ].map((craft) => (
              <div key={craft.title} className="space-y-4 font-inter">
                <div className="w-12 h-[2px] bg-[#c9a465]" />
                <h3 className="text-base font-medium tracking-wide text-[#1a1a1a] uppercase">
                  {craft.title}
                </h3>
                <p className="text-sm text-[#4a4a4a] leading-relaxed font-light">
                  {craft.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a465] font-inter">
              The Journey
            </span>
            <h2 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
              From Vision to Heirloom
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 font-inter">
            {[
              {
                step: "01",
                title: "Consultation",
                description: "A personal dialogue to understand your aesthetic, occasion, and cultural preferences.",
              },
              {
                step: "02",
                title: "Design",
                description: "Custom sketches, fabric swatches, and embroidery samples curated for your approval.",
              },
              {
                step: "03",
                title: "Craftsmanship",
                description: "200–600 hours of hand-embroidery by our master karigars, with periodic progress updates.",
              },
              {
                step: "04",
                title: "Fitting & Delivery",
                description: "Trial fittings to ensure a flawless drape, followed by careful packaging and delivery.",
              },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <span className="text-2xl font-light text-[#c9a465] font-cormorant">
                  {item.step}
                </span>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#1a1a1a]">
                  {item.title}
                </h3>
                <p className="text-sm text-[#4a4a4a] leading-relaxed font-light">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Grid */}
      <section className="py-24 bg-[#faf8f5] border-t border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative aspect-[3/4] col-span-1 row-span-2 border border-[#e8e0d5]/40 overflow-hidden">
              <Image
                src="/images/velvet_lehenga.png"
                alt="Atelier piece — velvet lehenga"
                fill
                sizes="(max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square border border-[#e8e0d5]/40 overflow-hidden">
              <Image
                src="/images/ivory_lehenga.png"
                alt="Atelier piece — ivory mirror work"
                fill
                sizes="(max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square border border-[#e8e0d5]/40 overflow-hidden">
              <Image
                src="/images/rose_lehenga.png"
                alt="Atelier piece — rose embroidery"
                fill
                sizes="(max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square col-span-2 border border-[#e8e0d5]/40 overflow-hidden">
              <Image
                src="/images/hero_lehenga.png"
                alt="Atelier showroom"
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white text-center">
        <div className="max-w-2xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Begin Your Bespoke Journey
          </h2>
          <p className="text-sm text-[#4a4a4a] leading-relaxed font-inter font-light">
            Every MEI creation starts with a conversation. Tell us about your vision and let our artisans bring it to life.
          </p>
          <div className="pt-2">
            <Link
              href="/contact"
              className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-3.5 px-10 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 font-inter"
            >
              Get a Custom Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
