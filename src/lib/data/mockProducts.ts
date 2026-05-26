import { Product, Category } from "@/types";

export const MOCK_CATEGORIES: Category[] = [
  {
    id: "lehengas",
    name: "Lehengas",
    slug: "lehengas",
    description: "Handcrafted bridal and couture lehengas made with exquisite materials.",
    image: "/images/rose_lehenga.png",
    subtitle: "Bridal Classics"
  },
  {
    id: "sarees",
    name: "Sarees",
    slug: "sarees",
    description: "Classic handloom and embroidered sarees for timeless celebrations.",
    image: "/images/velvet_lehenga.png",
    subtitle: "Heritage Drapes"
  },
  {
    id: "anarkalis",
    name: "Anarkalis",
    slug: "anarkalis",
    description: "Regal silhouettes with delicate hand-embroidery and flowing fabrics.",
    image: "/images/ivory_lehenga.png",
    subtitle: "Royal Silhouettes"
  }
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod_rose_lehenga",
    name: "The Rose Lehenga",
    slug: "the-rose-lehenga",
    price: 245000,
    images: [
      "/images/rose_lehenga.png",
      "/images/hero_lehenga.png",
      "/images/velvet_lehenga.png"
    ],
    shortDescription: "A masterpiece in rose-red silk with detailed gold Zardosi embroidery.",
    description: "Handcrafted over 320 hours by our master artisans, The Rose Lehenga features intricate Aari embroidery and gold Zardosi borders on premium silk. The ensemble includes a heavily embellished blouse and a sheer organza dupatta with scalloped borders. Perfect for the traditional bride seeking timeless elegance.",
    craftType: "Zardosi & Aari",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_royal_velvet",
    name: "The Royal Velvet Lehenga",
    slug: "the-royal-velvet-lehenga",
    price: 285000,
    images: [
      "/images/velvet_lehenga.png",
      "/images/rose_lehenga.png"
    ],
    shortDescription: "Deep maroon velvet lehenga featuring majestic Mughal-inspired gold and silver embroidery.",
    description: "The Royal Velvet Lehenga represents the pinnacle of royal heritage wear. Tailored in plush deep maroon velvet, it displays intricate motifs inspired by Mughal architecture, stitched in premium metallic threads. Accompanied by a heavy raw-silk blouse and a tissue dupatta.",
    craftType: "Dabka & Zardosi",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_ivory_mirror",
    name: "The Ivory Mirror Lehenga",
    slug: "the-ivory-mirror-lehenga",
    price: 195000,
    images: [
      "/images/ivory_lehenga.png",
      "/images/hero_lehenga.png"
    ],
    shortDescription: "Delicate ivory georgette lehenga adorned with hand-woven mirror work and silver thread embroidery.",
    description: "Designed for modern daytime ceremonies or grand sangeet functions, this ivory georgette lehenga sparkles with hundreds of hand-placed mirror embellishments and delicate resham work. Includes a matching sleeveless blouse and a lightweight net dupatta.",
    craftType: "Mirror & Resham Work",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_gilded_heritage",
    name: "The Gilded Heritage Lehenga",
    slug: "the-gilded-heritage-lehenga",
    price: 320000,
    images: [
      "/images/hero_lehenga.png",
      "/images/rose_lehenga.png"
    ],
    shortDescription: "Luxurious crimson silk lehenga with antique gold embroidery and custom border work.",
    description: "An heirloom-grade bridal lehenga featuring traditional kalis crafted in raw silk. The skirt is detailed with custom borders showcasing floral vines and peacock motifs. Embellished with fine pearls, dabka work, and sequence highlights.",
    craftType: "Pita & Dabka Work",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_rose_lehenga1",
    name: "The Rose Lehenga",
    slug: "the-rose-lehenga",
    price: 245000,
    images: [
      "/images/rose_lehenga.png",
      "/images/hero_lehenga.png",
      "/images/velvet_lehenga.png"
    ],
    shortDescription: "A masterpiece in rose-red silk with detailed gold Zardosi embroidery.",
    description: "Handcrafted over 320 hours by our master artisans, The Rose Lehenga features intricate Aari embroidery and gold Zardosi borders on premium silk. The ensemble includes a heavily embellished blouse and a sheer organza dupatta with scalloped borders. Perfect for the traditional bride seeking timeless elegance.",
    craftType: "Zardosi & Aari",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_royal_velvet1",
    name: "The Royal Velvet Lehenga",
    slug: "the-royal-velvet-lehenga",
    price: 285000,
    images: [
      "/images/velvet_lehenga.png",
      "/images/rose_lehenga.png"
    ],
    shortDescription: "Deep maroon velvet lehenga featuring majestic Mughal-inspired gold and silver embroidery.",
    description: "The Royal Velvet Lehenga represents the pinnacle of royal heritage wear. Tailored in plush deep maroon velvet, it displays intricate motifs inspired by Mughal architecture, stitched in premium metallic threads. Accompanied by a heavy raw-silk blouse and a tissue dupatta.",
    craftType: "Dabka & Zardosi",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_ivory_mirror1",
    name: "The Ivory Mirror Lehenga",
    slug: "the-ivory-mirror-lehenga",
    price: 195000,
    images: [
      "/images/ivory_lehenga.png",
      "/images/hero_lehenga.png"
    ],
    shortDescription: "Delicate ivory georgette lehenga adorned with hand-woven mirror work and silver thread embroidery.",
    description: "Designed for modern daytime ceremonies or grand sangeet functions, this ivory georgette lehenga sparkles with hundreds of hand-placed mirror embellishments and delicate resham work. Includes a matching sleeveless blouse and a lightweight net dupatta.",
    craftType: "Mirror & Resham Work",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  },
  {
    id: "prod_gilded_heritage1",
    name: "The Gilded Heritage Lehenga",
    slug: "the-gilded-heritage-lehenga",
    price: 320000,
    images: [
      "/images/hero_lehenga.png",
      "/images/rose_lehenga.png"
    ],
    shortDescription: "Luxurious crimson silk lehenga with antique gold embroidery and custom border work.",
    description: "An heirloom-grade bridal lehenga featuring traditional kalis crafted in raw silk. The skirt is detailed with custom borders showcasing floral vines and peacock motifs. Embellished with fine pearls, dabka work, and sequence highlights.",
    craftType: "Pita & Dabka Work",
    categoryId: "lehengas",
    categoryName: "Lehengas",
    inStock: true
  }
];
