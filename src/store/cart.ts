import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

// Same product in different colors OR different stitching types = separate line items
function itemKey(
  id: string,
  colorId: string | null,
  stitchingType: string | null
): string {
  return `${id}:${colorId ?? ""}:${stitchingType ?? ""}`;
}

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string, colorId: string | null, stitchingType: string | null) => void;
  updateQuantity: (
    id: string,
    colorId: string | null,
    stitchingType: string | null,
    quantity: number
  ) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const key = itemKey(item.id, item.color_id, item.stitching_type);
          const existing = state.items.find(
            (i) => itemKey(i.id, i.color_id, i.stitching_type) === key
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i.id, i.color_id, i.stitching_type) === key
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        });
      },

      removeItem: (id, colorId, stitchingType) =>
        set((state) => ({
          items: state.items.filter(
            (i) => itemKey(i.id, i.color_id, i.stitching_type) !== itemKey(id, colorId, stitchingType)
          ),
        })),

      updateQuantity: (id, colorId, stitchingType, quantity) => {
        if (quantity < 1) {
          get().removeItem(id, colorId, stitchingType);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i.id, i.color_id, i.stitching_type) === itemKey(id, colorId, stitchingType)
              ? { ...i, quantity }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "mei-cart" }
  )
);

export type { CartItem };