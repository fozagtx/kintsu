import Link from 'next/link';
import { MUG, money } from '../lib/pricing';

export default function Home() {
  return (
    <>
      <h1>Catalog</h1>
      <div className="card">
        <h2>{MUG.name}</h2>
        <p>{money(MUG.priceCents)}</p>
        <Link className="button" href={`/product/${MUG.slug}`}>View the {money(MUG.priceCents)} mug</Link>
      </div>
    </>
  );
}
