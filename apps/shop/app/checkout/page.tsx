'use client';
import { useRouter } from 'next/navigation';
import { useCart } from '../../lib/cart';
import { money, priceCart } from '../../lib/pricing';

export default function Checkout() {
  const [cart, , ready] = useCart();
  const router = useRouter();
  if (!ready) return null;
  const t = priceCart(cart);
  return (
    <>
      <h1>Checkout</h1>
      <div className="card">
        <div className="row"><span>Merchandise</span><span>{money(t.merch)}</span></div>
        <div className="row"><span>Discount</span><span>-{money(t.discount)}</span></div>
        <div className="row"><span>Gift wrap</span><span>{money(t.wrap)}</span></div>
        <div className="row"><span>Tax</span><span>{money(t.tax)}</span></div>
        <div className="row total"><span>Total</span><span>{money(t.total)}</span></div>
      </div>
      <button onClick={() => router.push('/confirmation')}>Pay {money(t.total)}</button>
    </>
  );
}
