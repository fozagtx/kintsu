import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = { title: 'Kintsu Shop' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">Kintsu Shop</Link>
          <Link href="/cart">Cart</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
