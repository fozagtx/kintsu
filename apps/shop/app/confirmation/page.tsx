'use client';
import { useCart } from '../../lib/cart';
import { money, priceCart } from '../../lib/pricing';

export default function Confirmation() {
  const [cart, , ready] = useCart();
  if (!ready) return null;
  const paid = sessionStorage.getItem('kintsu-paid');
  const total = paid !== null ? Number(paid) : priceCart(cart).total;
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
