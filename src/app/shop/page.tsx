import type { Metadata } from "next";
import { getProducts } from "@/lib/services/products";
import ShopClient from "@/components/shop/ShopClient";

export const metadata: Metadata = {
  title: "Explore Collections",
  description:
    "Discover our premium handcrafted bridal lehengas, couture sarees, and custom outfits tailored for your special occasions.",
};

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* Category Banner */}
      <div className="bg-[#a69c90] py-28 text-center select-none flex flex-col justify-center items-center">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#e5c185] mb-2 font-inter">
          BRIDAL MASTERPIECES
        </span>
        <h1 className="text-5xl font-light text-white font-cormorant italic select-none">
          All Collections
        </h1>
      </div>

      {/* Client component handles filtering and display */}
      <ShopClient products={products} />
    </main>
  );
}
