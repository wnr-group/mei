// Always renders the promo text configured in admin Settings (promo_strip_text).
// Intentionally static — it does not react to cart contents — so the message
// stays consistent with what the admin sets.
export default function PromoStrip({ defaultText }: { defaultText?: string }) {
  const message = defaultText?.trim();
  if (!message) return null;

  return (
    <div className="bg-[#c9a465] text-white text-xs font-bold uppercase tracking-[0.2em] py-2.5 text-center font-inter select-none">
      {message}
    </div>
  );
}
