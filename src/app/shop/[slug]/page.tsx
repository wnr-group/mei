import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/services/products";
import ImageGallery from "@/components/product/ImageGallery";
import ProductCard from "@/components/shop/ProductCard";
import ProductDetailClient from "@/components/product/ProductDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
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
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  // Targeted query: only fetch 3 products in the same category
  const recommendations = await getRelatedProducts(
    product.category_id,
    product.id,
    3
  );

  return (
    <main className="flex-1 bg-white">
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
                ? `/shop/category/${product.category.slug}`
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
            <ImageGallery images={product.images} />
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
                {product.work_types.map((type) => (
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
