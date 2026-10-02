import type { ShoppingCartItemModelDto } from '../api/types';

export interface CartSummary {
  itemCount: number;
  lineCount: number;
  subtotalValue: number;
}

export function summarizeCart(items: readonly ShoppingCartItemModelDto[]): CartSummary {
  return items.reduce<CartSummary>(
    (acc, item) => ({
      itemCount: acc.itemCount + item.quantity,
      lineCount: acc.lineCount + 1,
      subtotalValue: round2(acc.subtotalValue + item.unit_price_value * item.quantity),
    }),
    { itemCount: 0, lineCount: 0, subtotalValue: 0 },
  );
}

/** Clamps a requested quantity to the product's allowed range. */
export function clampQuantity(requested: number, min = 1, max = 10_000): number {
  if (!Number.isFinite(requested)) return min;
  const whole = Math.trunc(requested);
  return Math.min(Math.max(whole, min), max);
}

/** Parses free-text quantity input; returns null when it is not a usable integer. */
export function parseQuantityInput(text: string): number | null {
  if (!/^\d{1,5}$/.test(text.trim())) return null;
  const value = Number.parseInt(text, 10);
  return value > 0 ? value : null;
}

export function formatMoney(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
