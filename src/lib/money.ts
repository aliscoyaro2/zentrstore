export function naira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

export const DELIVERY_FEE_KOBO = 80000;

export function serviceFeeKobo(subtotalKobo: number): number {
  return Math.max(5000, Math.round(subtotalKobo * 0.03));
}
