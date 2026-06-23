"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { filterProducts } from "@/lib/utils/filterProducts";
import { trackSearch } from "@/lib/analytics/trackSearch";
import type { Product } from "@/types";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export default function SearchModal({ isOpen, onClose, products }: SearchModalProps) {
  // Future-proof state: loading enables async Supabase swap without UI refactor
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Two-stage animation: mounted gates DOM presence; animateIn drives CSS transitions
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Mount/unmount with enter/exit animation + state reset on open
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      setQuery("");
      setResults([]);
      setHighlightedIndex(-1);
      const id = requestAnimationFrame(() => setAnimateIn(true));
      return () => cancelAnimationFrame(id);
    } else {
      setAnimateIn(false);
      const id = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Focus input after mount animation frame
  useEffect(() => {
    if (isOpen && mounted) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen, mounted]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Sync results from query (client-side for now; swap to async fetch for Supabase)
  useEffect(() => {
    const filtered = filterProducts(products, query, ["name"]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResults(filtered.slice(0, 10));
    setHighlightedIndex(-1);
    if (query.trim()) {
      trackSearch(query.trim());
    }
  }, [query, products]);

  // Keyboard: Esc / Arrow keys / Enter + Tab focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;

        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, -1));
          break;

        case "Enter":
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            router.push(`/shop/${results[highlightedIndex].slug}`);
            onClose();
          }
          break;

        case "Tab": {
          const modal = modalRef.current;
          if (!modal) return;
          const focusable = Array.from(
            modal.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          );
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, highlightedIndex, results, router]);

  if (!mounted) return null;

  return (
    // Outer wrapper — fades backdrop on enter/exit; click backdrop to close
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 transition-opacity duration-200 ease-in-out ${
        animateIn ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
      role="presentation"
    >
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal panel — scales + fades on enter/exit */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        className={`relative w-full max-w-xl bg-[#faf8f5] rounded-lg shadow-2xl overflow-hidden transition-all duration-200 ease-in-out ${
          animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="search-modal-title" className="sr-only">Search products</h2>

        {/* Input row */}
        <div className="flex items-center px-4 py-3 border-b border-[#e8e0d5]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5 text-[#c9a465] flex-shrink-0 mr-3"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pieces…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#1a1a1a] placeholder-[#9a9a9a] text-sm font-inter outline-none"
            aria-label="Search query"
          />
          <button
            onClick={onClose}
            className="ml-3 text-[#4a4a4a] hover:text-[#1a1a1a] transition-colors cursor-pointer"
            aria-label="Close search"
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
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() === "" ? (
            <p className="px-4 py-6 text-center text-xs text-[#9a9a9a] font-inter uppercase tracking-widest">
              Start typing to search
            </p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-xs text-[#9a9a9a] font-inter">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#9a9a9a] font-inter">
              No pieces found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul>
              {results.map((product, index) => {
                const imageSrc =
                  product.image_url ||
                  product.images?.[0] ||
                  "/images/placeholder.jpg";
                return (
                  <li key={product.id}>
                    <Link
                      href={`/shop/${product.slug}`}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        index === highlightedIndex
                          ? "bg-[#f5f0ea]"
                          : "hover:bg-[#f5f0ea]"
                      }`}
                    >
                      <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-[#e8e0d5]">
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] font-inter truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-[#4a4a4a] font-inter">
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(product.price)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
