-- ── Grant anon role SELECT permission on products table ────────────────────
-- Required for /api/razorpay/create-order to perform server-side price verification
-- Error 42501: permission denied for table products
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.product_media TO anon;
