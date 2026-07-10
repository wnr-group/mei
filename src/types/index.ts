import type { Database } from "@/lib/supabase/database";

type Tables = Database["public"]["Tables"];

// ── Raw DB row types (use for Supabase queries) ──────────────────────────────
export type DbProduct      = Tables["products"]["Row"];
export type DbCategory     = Tables["categories"]["Row"];
export type DbProductMedia = Tables["product_media"]["Row"];
export type DbOrder        = Tables["orders"]["Row"];
export type DbOrderItem    = Tables["order_items"]["Row"];
export type DbEnquiry = Tables["enquiries"]["Row"];
export type DbBanner = Tables["banners"]["Row"];

// ── Enums ─────────────────────────────────────────────────────────────────────
export type ProductStatus = Database["public"]["Enums"]["product_status"];
export type OrderStatus   = Database["public"]["Enums"]["order_status"];
export type EnquiryStatus = Database["public"]["Enums"]["enquiry_status"];

// ── Storefront view-model types (what pages and components receive) ───────────

export type StorefrontColor = {
  id: string;
  label: string;
  hex_code: string | null;
  swatch_image_url: string | null;
  sort_order: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;   // was: image
  subtitle: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  short_description: string | null;   // was: shortDescription
  description: string | null;
  work_types: string[];               // was: craftType: string
  status: ProductStatus;
  category_id: string | null;         // was: categoryId
  category: Pick<Category, "id" | "name" | "slug"> | null;  // was: categoryName
  image_url: string | null;           // primary image fallback from products table
  images: string[];                   // urls from product_media, sorted by sort_order
  colors: StorefrontColor[];           // color palette with swatches
  coloredMedia: { url: string; color_id: string | null }[];  // media with color associations
  // REMOVED: inStock (no DB equivalent — MEI is enquiry-based)
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;   // was: name
  quantity: number;
  unit_price: number;     // was: price
};

export type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: OrderStatus;    // was: lowercase union — now UPPERCASE to match DB
  total: number;
  notes: string | null;
  created_at: string;     // was: createdAt
  items?: OrderItem[];    // joined at read time
};

export type Banner = {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
};




// Insert type for the contact form (what gets written to Supabase)
export type EnquiryInsert = Tables["enquiries"]["Insert"];

// CartItem is a UI-only ephemeral type (not a DB table)
export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  work_types: string[];   // was: craftType: string
  quantity: number;
  color_id: string | null;
  color_label: string | null;
};
