import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types";

type WishlistStore = {
  items: Product[];
  add: (product: Product) => void;
  remove: (id: string) => void;
  toggle: (product: Product) => void;
  isWishlisted: (id: string) => boolean;
};

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      add: (product) => {
        set((state) => {
          const exists = state.items.some((item) => item.id === product.id);
          if (exists) return {};
          return { items: [...state.items, product] };
        });
      },

      remove: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      toggle: (product) => {
        const isCurrentlyWishlisted = get().isWishlisted(product.id);
        if (isCurrentlyWishlisted) {
          get().remove(product.id);
        } else {
          get().add(product);
        }
      },

      isWishlisted: (id) => {
        return get().items.some((item) => item.id === id);
      },
    }),
    { name: "mei-wishlist" }
  )
);
