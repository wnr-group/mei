import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import Header, { type HeaderNavCategory } from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PromoStrip from "@/components/layout/PromoStrip";
import { getCategories } from "@/lib/services/categories";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MEI Bridal Couture — Handcrafted Elegance",
  description:
    "Premium Indian bridal wear — Lehengas, Sarees, and Bespoke Couture. Handcrafted with Aari, Zardosi, and Mirror embroidery.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Drive the header nav from live categories. A fetch failure must not take
  // down every page, so fall back to an empty nav (New Arrivals / Atelier /
  // Contact still render).
  let navCategories: HeaderNavCategory[] = [];
  try {
    const categories = await getCategories();
    navCategories = categories.map((category) => ({
      slug: category.slug,
      name: category.name,
    }));
  } catch (error) {
    console.error("[RootLayout] Failed to load nav categories", error);
  }

  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-[#1A1A1A] antialiased">
        <PromoStrip />
        <Header categories={navCategories} />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
