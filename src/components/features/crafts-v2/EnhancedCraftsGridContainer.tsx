import Link from "next/link";
import Image from "next/image";
import CreativeCraftsGrid from "./CreativeCraftsGrid";
import type { CraftItem, CraftsMode } from "./crafts.types";

type EnhancedCraftsGridContainerProps = {
  mode?: CraftsMode;
  items?: CraftItem[];
};

export default function EnhancedCraftsGridContainer({
  mode = "base",
  items = [],
}: EnhancedCraftsGridContainerProps) {
  if (mode === "minimal") {
    return <CreativeCraftsGrid items={items} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((craft, idx) => (
        <Link
          key={idx}
          href="/shop"
          className="group relative aspect-square w-full flex items-end justify-center pb-8 overflow-hidden border border-[#e8e0d5]/10 bg-[#1a1a1a]"
        >
          {craft.image && (
            <Image
              src={craft.image}
              alt={craft.label}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
          <div className="text-center z-10 transition-transform duration-500 group-hover:translate-y-[-4px]">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
              {craft.label}
            </span>
            <div className="w-0 h-[1px] bg-white/50 mx-auto mt-2 transition-all duration-500 group-hover:w-full" />
          </div>
        </Link>
      ))}
    </div>
  );
}
