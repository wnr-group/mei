import { describe, it, expect } from "vitest";
import { filterProducts } from "../filterProducts";
import type { Product } from "@/types";

function p(id: string, name: string, short_description: string | null = null): Product {
  return {
    id,
    name,
    slug: id,
    price: 100000,
    short_description,
    description: null,
    work_types: [],
    status: "PUBLISHED",
    category_id: "cat1",
    category: { id: "cat1", name: "Lehengas", slug: "lehengas" },
    image_url: "/img/test.png",
    images: ["/img/test.png"],
    colors: [],
    coloredMedia: [],
  };
}

const catalogue: Product[] = [
  p("p1", "The Rose Lehenga",         "A masterpiece in rose-red silk."),
  p("p2", "The Royal Velvet Lehenga", "Deep maroon velvet."),
  p("p3", "Ivory Blush Anarkali",     null),
];

describe("filterProducts — default field (name)", () => {
  it("returns empty array for empty query", () => {
    expect(filterProducts(catalogue, "")).toHaveLength(0);
  });

  it("returns empty array for whitespace-only query", () => {
    expect(filterProducts(catalogue, "   ")).toHaveLength(0);
  });

  it("trims leading/trailing whitespace before matching", () => {
    const result = filterProducts(catalogue, "  rose  ");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("matches by case-insensitive substring", () => {
    const result = filterProducts(catalogue, "rose");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("matches multiple products when query appears in several names", () => {
    const result = filterProducts(catalogue, "lehenga");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["p1", "p2"]);
  });

  it("is case-insensitive (UPPERCASE query)", () => {
    expect(filterProducts(catalogue, "IVORY")).toHaveLength(1);
  });

  it("is case-insensitive (MiXeD case query)", () => {
    expect(filterProducts(catalogue, "VeLvEt")).toHaveLength(1);
  });

  it("returns empty array when nothing matches", () => {
    expect(filterProducts(catalogue, "zzz-no-match")).toHaveLength(0);
  });

  it("handles empty products array", () => {
    expect(filterProducts([], "rose")).toHaveLength(0);
  });

  it("handles a very long query string without crashing", () => {
    const longQuery = "a".repeat(500);
    expect(filterProducts(catalogue, longQuery)).toHaveLength(0);
  });

  it("handles query with special characters without crashing", () => {
    expect(() => filterProducts(catalogue, "!@#$%^&*()")).not.toThrow();
    expect(filterProducts(catalogue, "!@#$%^&*()")).toHaveLength(0);
  });
});

describe("filterProducts — explicit fields", () => {
  it("searches short_description when specified", () => {
    const result = filterProducts(catalogue, "maroon", ["short_description"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  it("does not find a result in description when only name field is specified", () => {
    expect(filterProducts(catalogue, "maroon", ["name"])).toHaveLength(0);
  });

  it("searches across multiple fields simultaneously", () => {
    const byName = filterProducts(catalogue, "rose", ["name", "short_description"]);
    expect(byName).toHaveLength(1);
    expect(byName[0].id).toBe("p1");

    const byDesc = filterProducts(catalogue, "maroon", ["name", "short_description"]);
    expect(byDesc).toHaveLength(1);
    expect(byDesc[0].id).toBe("p2");
  });

  it("skips null field values without crashing", () => {
    expect(() =>
      filterProducts(catalogue, "anything", ["short_description"])
    ).not.toThrow();
  });
});
