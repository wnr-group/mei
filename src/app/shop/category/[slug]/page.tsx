// src/app/shop/category/[slug]/page.tsx
import { notFound } from "next/navigation";
import ShopClient from "@/components/shop/ShopClient";
import { getCategoryBySlug } from "@/lib/services/categories";
import { getProductsByCategory } from "@/lib/services/products";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    getProductsByCategory(slug),
  ]);

  if (!category) notFound();

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
