export const FREE_SHIPPING_THRESHOLD = 5000;
export const SHIPPING_FLAT_RATE = 150;

export function calculateShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
}

export function getRemainingForFreeShipping(subtotal: number): number {
  return Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
}
