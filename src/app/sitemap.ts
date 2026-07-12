import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config/site";
import { getProducts } from "@/lib/services/products";
import { getCategories } from "@/lib/services/categories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/new-arrivals`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/atelier`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((c) => c.is_active && c.slug)
    .map((c) => ({
      url: `${SITE_URL}/shop/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${SITE_URL}/shop/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
      images: p.images?.[0] ? [p.images[0]] : p.image_url ? [p.image_url] : undefined,
    }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
