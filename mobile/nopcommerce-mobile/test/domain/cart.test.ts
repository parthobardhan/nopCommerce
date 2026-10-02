import type { ShoppingCartItemModelDto } from '../../src/api/types';
import { clampQuantity, formatMoney, parseQuantityInput, round2, summarizeCart } from '../../src/domain/cart';

function item(overrides: Partial<ShoppingCartItemModelDto>): ShoppingCartItemModelDto {
  return {
    id: 1,
    sku: null,
    picture: null,
    product_id: 1,
    product_name: 'x',
    product_se_name: 'x',
    unit_price: '$1.00',
    unit_price_value: 1,
    sub_total: '$1.00',
    sub_total_value: 1,
    quantity: 1,
    warnings: [],
    ...overrides,
  };
}

describe('summarizeCart', () => {
  it('totals quantities, lines and subtotal with cent rounding', () => {
    const summary = summarizeCart([item({ id: 1, quantity: 3, unit_price_value: 19.99 }), item({ id: 2, quantity: 1, unit_price_value: 0.1 }), item({ id: 3, quantity: 1, unit_price_value: 0.2 })]);
    expect(summary).toEqual({ itemCount: 5, lineCount: 3, subtotalValue: 60.27 });
  });

  it('is zero for an empty cart', () => {
    expect(summarizeCart([])).toEqual({ itemCount: 0, lineCount: 0, subtotalValue: 0 });
  });
});

describe('clampQuantity', () => {
  it('clamps into range and truncates fractions', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(5.9, 1, 10)).toBe(5);
    expect(clampQuantity(50, 1, 10)).toBe(10);
    expect(clampQuantity(Number.NaN, 2)).toBe(2);
  });
});

describe('parseQuantityInput', () => {
  it('accepts only positive integers', () => {
    expect(parseQuantityInput('3')).toBe(3);
    expect(parseQuantityInput(' 12 ')).toBe(12);
    expect(parseQuantityInput('0')).toBeNull();
    expect(parseQuantityInput('-1')).toBeNull();
    expect(parseQuantityInput('2.5')).toBeNull();
    expect(parseQuantityInput('abc')).toBeNull();
    expect(parseQuantityInput('')).toBeNull();
  });
});

describe('money helpers', () => {
  it('formats USD and rounds to cents', () => {
    expect(formatMoney(1800)).toBe('$1,800.00');
    expect(round2(1.005)).toBe(1); // binary float; documents the behaviour
    expect(round2(2.675)).toBe(2.68);
  });
});
