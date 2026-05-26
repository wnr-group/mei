"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_PRODUCTS } from "@/lib/data/mockProducts";
import { useCartStore } from "@/store/cart";
import ImageGallery from "@/components/product/ImageGallery";
import ProductCard from "@/components/shop/ProductCard";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = use(params);
  const product = MOCK_PRODUCTS.find((p) => p.slug === slug);
  const addItem = useCartStore((state) => state.addItem);

  const [isAdded, setIsAdded] = useState(false);

  if (!product) {
    notFound();
  }

  // Get recommendations (excluding current product)
  const recommendations = MOCK_PRODUCTS.filter((p) => p.id !== product.id).slice(0, 3);

  // Format price helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      craftType: product.craftType,
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <main className="flex-1 bg-white">
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav className="text-xs uppercase tracking-widest text-[#9a9a9a] font-inter">
          <Link href="/" className="hover:text-[#c9a465] transition-colors">
            Collections
          </Link>{" "}
          /{" "}
          <Link href="/shop" className="hover:text-[#c9a465] transition-colors">
            {product.categoryName}
          </Link>{" "}
          / <span className="text-[#1a1a1a]">{product.name}</span>
        </nav>
      </div>

      {/* Main Details Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left Column: Image Gallery */}
          <div>
            <ImageGallery images={product.images} />
          </div>

          {/* Right Column: Info & Buy Section */}
          <div className="space-y-8 font-inter">
            {/* Headers */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-widest text-[#9a9a9a] font-medium block">
                {product.categoryName}
              </span>
              <h1 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
                {product.name}
              </h1>
              <p className="text-xl font-light text-[#1a1a1a] tracking-wide">
                {formatPrice(product.price)}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-4">
              <p className="text-sm text-[#4a4a4a] leading-relaxed font-light">
                {product.description}
              </p>

              {/* Craft tags */}
              <div className="flex flex-wrap gap-3 pt-2">
                <span className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
                  {product.craftType}
                </span>
                <span className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
                  Hand-Embroidered
                </span>
              </div>
            </div>

            {/* Add to Cart */}
            <div className="space-y-3 pt-6">
              <button
                onClick={handleAddToCart}
                className="w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer text-center"
              >
                {isAdded ? "Added to Cart" : "Add to Cart"}
              </button>
              
              <a
                href={`https://wa.me/919876543210?text=Hi,%20I'm%20interested%20in%20inquiring%20about%20${encodeURIComponent(product.name)}.`}
                target="_blank"
                rel="noreferrer"
                className="w-full border border-[#25d366] text-[#25d366] hover:bg-[#25d366]/5 py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.982L2 22l5.233-1.371a9.994 9.994 0 0 0 4.779 1.209c5.505 0 9.988-4.479 9.99-9.987A9.994 9.994 0 0 0 12.012 2Zm4.877 14.224c-.274.773-1.332 1.396-1.84 1.442-.469.043-.918.23-2.986-.593-2.647-1.053-4.32-3.779-4.453-3.955-.13-.177-1.07-1.428-1.07-2.723 0-1.294.673-1.929.914-2.19.24-.262.529-.326.705-.326.177 0 .354.001.508.008.16.007.375-.06.586.447.218.522.747 1.821.811 1.952.064.13.107.283.02.457-.086.174-.13.283-.26.435-.13.153-.274.34-.39.457-.13.13-.267.272-.116.533.152.26.678 1.117 1.453 1.808.998.89 1.839 1.166 2.099 1.296.26.13.412.109.564-.065.152-.174.652-.761.826-1.022.174-.261.347-.217.585-.13.24.086 1.52.717 1.78.847.26.13.435.195.499.304.065.109.065.631-.208 1.405Z"/>
                </svg>
                WhatsApp Inquiry
              </a>
            </div>

            {/* Guarantees */}
            
          </div>
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="bg-[#faf8f5] border-t border-[#e8e0d5]/40 py-20 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant">
              You May Also Like
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {recommendations.map((recommendation) => (
              <ProductCard key={recommendation.id} product={recommendation} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
