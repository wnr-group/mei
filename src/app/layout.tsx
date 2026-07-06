import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PromoStrip from "@/components/layout/PromoStrip";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import { getProducts } from "@/lib/services/products";

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
  const products = await getProducts();

  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-[#1A1A1A] antialiased">
        <PromoStrip />
        <Header products={products} />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
