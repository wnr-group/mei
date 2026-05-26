# MEI Storefront — User-Facing Gaps

> Last updated: 2026-05-26
> Status: Frontend gaps only (excludes backend/admin/integrations)

---

## High Priority

### 1. Search Modal
- Search icon in header does nothing
- Need: Modal overlay with text input, live results from product data
- Spec: Full-text search with Supabase tsvector (for now, can be client-side filter over mock data)

### 2. Navigation Categories
- **Current:** Collections / New Arrivals / Lehengas / The Atelier / Contact
- **Should be:** Bridal Jewellery | Designer Wear | Customized Costumes
- Work type filters remain on listing pages (already partially done)

### 3. Category-Specific Listing Pages
- Only `/shop` exists, hardcoded to "Lehengas"
- Need: Dynamic route `/shop/[category]` for each main category
- Each should show its own title, description, and filtered products

### 4. Razorpay Checkout Integration
- "Pay Now" button currently uses a fake setTimeout mock
- Need: Call Razorpay hosted checkout (standard integration)
- Can be wired to Edge Function later; for now, at minimum show the Razorpay modal with test keys

### 5. Product Data Diversity
- Currently 4 products duplicated to 8, all lehengas
- Need: Products across all 3 categories (Bridal Jewellery, Designer Wear, Customized Costumes)
- Each should have varied work types for filter testing

---

## Medium Priority

### 6. Floating WhatsApp Button
- Fixed position, bottom-right corner
- Green (#25D366) circle, 56px, white WhatsApp icon
- Links to `wa.me/91XXXXXXXXXX` with pre-filled store greeting
- Should appear on all pages

### 7. Shipping Threshold Logic
- Cart/checkout always shows "Free" shipping
- Need: Show ₹150 flat rate when subtotal < ₹5,000, free when >= ₹5,000
- Announcement bar should reflect this threshold

### 8. Work Type Tiles with Images
- Homepage "Our Craft" section has grey placeholder boxes
- Need: Actual images or at minimum better styled tiles for Aari, Zardosi, Mirror, Thread, Cut, Tailoring

### 9. Pagination Logic
- Pagination buttons on shop page are decorative
- Need: Actual pagination (or infinite scroll) once product count justifies it

### 10. SEO Metadata
- No `<title>`, `<meta description>`, Open Graph tags on any page
- Need: Per-page metadata using Next.js `metadata` export
- Structured data (JSON-LD) for products

---

## Low Priority

### 11. Remove Wishlist Icon
- Heart icon in header is not in V1 scope (no customer accounts)
- Remove to avoid confusion

### 12. Quote Form — Measurements Field
- Enquiry spec includes `measurements JSONB`
- Add optional measurements section (bust, waist, hip, shoulder, length, sleeve)

### 13. Quote Form — Reference Image Upload
- Spec allows up to 5 reference images with enquiry
- Add file upload UI (can be wired to Supabase Storage later)

### 14. Announcement Bar — Add WhatsApp Number
- Currently: "Free Shipping on orders above ₹5,000"
- Should also show WhatsApp contact number

### 15. Footer Links
- "About Us", "Craftsmanship", "FAQs" point to wrong routes
- Wire to correct pages or remove if pages don't exist yet

### 16. Dead "View All" Button
- Featured Pieces section has a "View All" button that goes nowhere
- Should link to `/shop`

---

## Notes
- Light theme (white/cream) is the confirmed direction — no dark navy
- All data currently comes from `mockProducts.ts` — will be replaced with Supabase queries later
- Backend (ecommerce-supabase-kit) and Admin panel are separate workstreams tracked in the main implementation plan
