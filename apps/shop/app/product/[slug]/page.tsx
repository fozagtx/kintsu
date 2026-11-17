'use client';
import { useRouter } from 'next/navigation';
import { MUG, money } from '../../../lib/pricing';
import { readCart, writeCart } from '../../../lib/cart';

export default function Product() {
  const router = useRouter();
  const add = () => {
    const cart = readCart();
    writeCart({ ...cart, qty: cart.qty + 1 });
    router.push('/cart');
  };
  return (
    <>
      <h1>{MUG.name}</h1>
      <div className="card">
        <p>A stoneware mug repaired with gold seams.</p>
        <p><strong>{money(MUG.priceCents)}</strong></p>
        <button onClick={add}>Add to cart</button>
      </div>
    </>
  );
}
