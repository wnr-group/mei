export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919876543210";

export function isValidWhatsAppNumber(number: string): boolean {
  const digitOnly = number.replace(/\D/g, "");
  return digitOnly === number && number.length >= 7 && number.length <= 15;
}

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
