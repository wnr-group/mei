import type { Product } from "@/types";

export type SearchableField = "name" | "short_description" | "description";

export function filterProducts(
  products: Product[],
  query: string,
  fields: ReadonlyArray<SearchableField> = ["name"]
): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return products.filter((product) =>
    fields.some((field) => {
      const value = product[field];
      return value != null && value.toLowerCase().includes(q);
    })
  );
}
