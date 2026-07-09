import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, getProductsByCategory } from "@/lib/services/products";
import { getCategoryBySlug } from "@/lib/services/categories";
import ImageGallery from "@/components/product/ImageGallery";
import ProductCard from "@/components/shop/ProductCard";
import ProductDetailClient from "@/components/product/ProductDetailClient";
import ShopClient from "@/components/shop/ShopClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug);

  // 1. Check if it's a product
  const product = await getProductBySlug(normalizedSlug);
  if (product) {
    const title = product.name;
    const description = product.short_description || product.description || `Buy ${product.name} at MEI Bridal Couture.`;
    const image = product.images?.[0] || product.image_url || "/images/hero_lehenga.png";
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        images: [{ url: image }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  }

  // 2. Check if it's a category
  const category = await getCategoryBySlug(normalizedSlug);
  if (category) {
    const title = category.name;
    const description = category.description || `Explore our ${category.name} collection at MEI Bridal Couture.`;
    const image = category.image_url || "/images/hero_lehenga.png";
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        images: [{ url: image }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  }

  return {};
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug);
  const product = await getProductBySlug(normalizedSlug);

  if (product) {
    // Targeted query: only fetch 3 products in the same category
    const recommendations = await getRelatedProducts(
      product.category_id,
      product.id,
      3
    );

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "image": product.images?.[0] || product.image_url || "",
      "description": product.description || product.short_description || "",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "INR",
        "price": product.price,
        "availability": "https://schema.org/InStock",
      },
    };

    return (
      <main className="flex-1 bg-white">
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Breadcrumbs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <nav className="text-xs uppercase tracking-widest text-[#9a9a9a] font-inter">
            <Link href="/" className="hover:text-[#c9a465] transition-colors">
              Collections
            </Link>{" "}
            /{" "}
            <Link
              href={
                product.category
                  ? `/shop/${product.category.slug}`
                  : "/shop"
              }
              className="hover:text-[#c9a465] transition-colors"
            >
              {product.category?.name ?? "Shop"}
            </Link>{" "}
            / <span className="text-[#1a1a1a]">{product.name}</span>
          </nav>
        </div>

        {/* Main Details */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <ImageGallery
                images={product.images}
                coloredMedia={product.coloredMedia}
                colors={product.colors}
              />
            </div>

            <div className="space-y-8 font-inter">
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-widest text-[#9a9a9a] font-medium block">
                  {product.category?.name ?? ""}
                </span>
                <h1 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
                  {product.name}
                </h1>
                <p className="text-xl font-light text-[#1a1a1a] tracking-wide">
                  {formatPrice(product.price)}
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-[#4a4a4a] leading-relaxed font-light">
                  {product.description}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {product.work_types?.map((type) => (
                    <span
                      key={type}
                      className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none"
                    >
                      {type}
                    </span>
                  ))}
                  <span className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
                    Hand-Embroidered
                  </span>
                </div>
              </div>

              <ProductDetailClient product={product} />
            </div>
          </div>
        </div>

        {/* Recommendations — only rendered when results exist */}
        {recommendations.length > 0 && (
          <div className="bg-[#faf8f5] border-t border-[#e8e0d5]/40 py-20 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <div className="text-center">
                <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant">
                  You May Also Like
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {recommendations.map((r) => (
                  <ProductCard key={r.id} product={r} />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // If not a product, try category
  const category = await getCategoryBySlug(normalizedSlug);

  if (category) {
    const products = await getProductsByCategory(normalizedSlug);

    return (
      <main className="flex-1 bg-white min-h-screen">
        {/* Category banner */}
        <div className="bg-[#a69c90] py-28 text-center select-none flex flex-col justify-center items-center gap-2">
          {category.subtitle && (
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#e5c185] font-inter">
              {category.subtitle}
            </span>
          )}
          <h1 className="text-5xl font-light text-white font-cormorant italic">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-sm text-white/70 font-inter mt-2 max-w-md px-4">
              {category.description}
            </p>
          )}
        </div>

        {/* Product grid with dynamic filters */}
        {products.length === 0 ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center font-inter">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9a9a9a]">
              No products found in this category.
            </p>
          </div>
        ) : (
          <ShopClient products={products} />
        )}
      </main>
    );
  }

  // Neither product nor category found
  notFound();
}
