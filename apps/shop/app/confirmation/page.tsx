'use client';
import { useCart } from '../../lib/cart';
import { money, priceCart } from '../../lib/pricing';

export default function Confirmation() {
  const [cart, , ready] = useCart();
  if (!ready) return null;
  const quote = sessionStorage.getItem('kintsu-quote');
  const total = quote !== null ? Number(quote) : priceCart(cart).total;
  return (
    <>
      <h1>Order confirmed</h1>
      <div className="card">
        <p className="ok">Thank you. Your payment went through.</p>
        <div className="row total"><span>Total paid</span><span>{money(total)}</span></div>
      </div>
    </>
  );
}
