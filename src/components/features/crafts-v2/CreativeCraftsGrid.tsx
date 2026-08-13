"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { CraftItem } from "./crafts.types";
import styles from "./CreativeCraftsGrid.module.css";

export const SCROLL_RANGE_PX = 8;
export const HOVER_SCALE = 1.015;

type CreativeCraftsGridProps = {
  items: CraftItem[];
};

export default function CreativeCraftsGrid({ items }: CreativeCraftsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((craft) => (
        <CraftCard key={craft.label} craft={craft} />
      ))}
    </div>
  );
}

function CraftCard({ craft }: { craft: CraftItem }) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [canHover, setCanHover] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanHover(mediaQuery.matches);
  }, []);

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });

  const rawY = useTransform(scrollYProgress, [0, 1], [-SCROLL_RANGE_PX, SCROLL_RANGE_PX]);
  const y = useTransform(rawY, (value) => (prefersReducedMotion ? 0 : value));

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        ref={cardRef}
        href="/shop"
        className={`group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden bg-[#1a1a1a] ${styles.card}`}
      >
      <motion.div
        className={styles.imageWrap}
        style={{
          top: -SCROLL_RANGE_PX,
          bottom: -SCROLL_RANGE_PX,
          y,
          willChange: "transform",
        }}
        whileHover={canHover && !prefersReducedMotion ? { scale: HOVER_SCALE } : undefined}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        {craft.image && (
          <Image
            src={craft.image}
            alt={craft.label}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-500 group-hover:from-black/85 pointer-events-none" />

      {/* Corner Decorative Dots */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-[#c9a465] rounded-full" />
        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#c9a465] rounded-full" />
        <div className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-[#c9a465] rounded-full" />
        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#c9a465] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between p-4 sm:p-5">
        {/* Main Typography */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center transition-transform duration-500 group-hover:translate-y-[-3px]">
            <span className="block text-2xl sm:text-3xl lg:text-4xl font-light tracking-[0.08em] text-[#E8D5B5] uppercase font-cormorant leading-tight">
              {craft.label}
            </span>
          </div>
        </div>

        {/* Bottom Metadata */}
        {(craft.estHours || craft.craftNumber) && (
          <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-[#E8DCC5] uppercase border-t border-[#E8DCC5]/30 pt-2.5">
            {craft.estHours && <span>{craft.estHours}</span>}
            {craft.craftNumber && <span>{craft.craftNumber}</span>}
          </div>
        )}
      </div>
    </Link>
    </motion.div>
  );
}
