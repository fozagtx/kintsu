'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '../../lib/cart';
import { COUPONS, MUG, money, priceCart } from '../../lib/pricing';

export default function CartPage() {
  const [cart, setCart, ready] = useCart();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  if (!ready) return null;
  if (cart.qty === 0) return (<><h1>Cart</h1><p>Your cart is empty. <Link href="/">Shop</Link></p></>);

  const t = priceCart(cart);
  const apply = () => {
    const c = code.trim().toUpperCase();
    if (!(c in COUPONS)) return setMsg('That coupon is not valid.');
    const next = { ...cart, coupon: c };
    setCart(next);
    sessionStorage.setItem('kintsu-quote', String(priceCart(next).total));
    setMsg(`Coupon ${c} applied.`);
  };

  return (
    <>
      <h1>Cart</h1>
      <div className="card">
        <div className="row"><span>{MUG.name}</span><span>Quantity: {cart.qty}</span></div>
        <div className="controls">
          <label>
            Quantity{' '}
            <button onClick={() => setCart({ ...cart, qty: Math.max(1, cart.qty - 1) })}>-</button>{' '}
            <button onClick={() => setCart({ ...cart, qty: cart.qty + 1 })}>+</button>
          </label>
          <label>
            Coupon code{' '}
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Coupon code" />{' '}
            <button onClick={apply}>Apply coupon</button>
          </label>
          {msg && <p className="note">{msg}</p>}
          <label>
            <input type="checkbox" checked={cart.wrap} onChange={(e) => setCart({ ...cart, wrap: e.target.checked })} /> Add gift wrap ($5.00)
          </label>
        </div>
      </div>
      <div className="card">
        <div className="row"><span>Merchandise subtotal</span><span>{money(t.merch)}</span></div>
        {cart.coupon && <div className="row"><span>Discount ({cart.coupon})</span><span>-{money(t.discount)}</span></div>}
        {cart.wrap && <div className="row"><span>Gift wrap</span><span>{money(t.wrap)}</span></div>}
      </div>
      <Link className="button" href="/checkout">Go to checkout</Link>
    </>
  );
}
