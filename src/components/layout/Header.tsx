"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartStore } from "@/store/cart";
import { useEffect, useRef, useState } from "react";
import SearchModal from "@/components/search/SearchModal";
import type { Product } from "@/types";

export default function Header({ products }: { products: Product[] }) {
  const pathname = usePathname();
  const itemCount = useCartStore((state) => state.itemCount);
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSearchClose = () => {
    setSearchOpen(false);
    // Restore focus to the trigger so keyboard users don't lose their place
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };

  // Derive unique categories from the products list (deduped by id)
  const categories = Array.from(
    products
      .map((p) => p.category)
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .reduce((map, cat) => map.set(cat.id, cat), new Map<string, { id: string; name: string; slug: string }>())
      .values()
  );

  const navLinks = [
    { href: "/new-arrivals", label: "New Arrivals" },
    ...categories.map((category) => ({
      href: `/shop/${category.slug}`,
      label: category.name,
    })),
    { href: "/atelier", label: "The Atelier" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <>
      <header className="top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e8e0d5]/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 mt-7 mb-0">
          {/* Row 1: Logo & Icons */}
          <div className="relative flex justify-between items-center h-12">
            {/* Invisible Spacer to center logo */}
            <div className="flex-1 md:block hidden" />

            {/* Logo (Centered) */}
            <div className="flex-1 text-center md:absolute md:left-1/2 md:-translate-x-1/2 flex flex-col items-center">
              <Link href="/" className="inline-block group">
                <h1 className="text-3xl font-bold tracking-[0.25em] uppercase text-[#c9a465] group-hover:text-[#d4b87a] transition-colors duration-300 font-inter select-none leading-none text-center">
                  MEI
                </h1>
                <span className="block text-[10px] font-bold uppercase tracking-[0.35em] text-[#c9a465] group-hover:text-[#d4b87a] transition-colors duration-300 mt-1 font-inter text-center">
                  BRIDAL COUTURE
                </span>
              </Link>
            </div>

            {/* Right Action Icons */}
            <div className="flex-1 flex justify-end items-center space-x-6">
              {/* Search Button */}
              <button
                ref={searchButtonRef}
                onClick={() => setSearchOpen(true)}
                className="text-[#1a1a1a] hover:text-[#c9a465] transition-colors duration-300 cursor-pointer"
                aria-label="Open search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
                  />
                </svg>
              </button>

              {/* Wishlist Button */}
              <button className="text-[#1a1a1a] hover:text-[#c9a465] transition-colors duration-300 cursor-pointer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                  />
                </svg>
              </button>

              {/* Cart Button */}
              <Link
                href="/cart"
                className="relative text-[#1a1a1a] hover:text-[#c9a465] transition-colors duration-300 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                {mounted && itemCount() > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#c9a465] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center font-inter">
                    {itemCount()}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Row 2: Centered Navigation links */}
          <div className="mt-4 flex justify-start md:justify-center pt-4 overflow-x-auto scrollbar-none w-full">
            <nav className="flex space-x-8 sm:space-x-12 px-6 md:px-0 whitespace-nowrap">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`text-xs sm:text-[13px] font-inter font-medium uppercase tracking-[0.18em] transition-all pb-1.5 relative group hover:text-[#c9a465] ${isActive ? "text-[#c9a465]" : "text-[#4a4a4a]"
                      }`}
                  >
                    {link.label}
                    <span
                      className={`absolute bottom-0 left-0 w-full h-[1.5px] bg-[#c9a465] transform transition-transform duration-300 origin-left ${isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                        }`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <SearchModal
        isOpen={searchOpen}
        onClose={handleSearchClose}
        products={products}
      />
    </>
  );
}
