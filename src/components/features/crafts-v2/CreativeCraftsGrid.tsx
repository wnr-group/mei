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
    <Link
      ref={cardRef}
      href="/shop"
      className={`group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden border border-[#e8e0d5]/10 bg-[#1a1a1a] ${styles.card}`}
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

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

      <div className="text-center z-10 px-4 space-y-2">
        <span className="block text-lg sm:text-xl lg:text-2xl font-light tracking-wider text-white uppercase">
          {craft.label}
        </span>
      </div>
    </Link>
  );
}
