export const MUG = { slug: 'mug', name: 'Kintsu Mug', priceCents: 4000 };
export const WRAP_FEE_CENTS = 500;
export const TAX_RATE = 0.1;
export const COUPONS: Record<string, number> = { SAVE10: 0.1 };

export type Cart = { qty: number; coupon: string | null; wrap: boolean };

export type Totals = {
  merch: number;
  discount: number;
  wrap: number;
  taxable: number;
  tax: number;
  total: number;
};

export function priceCart(cart: Cart): Totals {
  const merch = MUG.priceCents * cart.qty;
  const wrap = cart.wrap ? WRAP_FEE_CENTS : 0;
  const rate = cart.coupon ? COUPONS[cart.coupon] ?? 0 : 0;
  const discount = Math.round(merch * rate);
  const taxable = merch - discount + wrap;
  const tax = Math.round(taxable * TAX_RATE);
  return { merch, discount, wrap, taxable, tax, total: taxable + tax };
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
