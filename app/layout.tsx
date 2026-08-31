import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Yo Palp - Study Studio',
  description: 'Your AI-powered study and wellbeing companion',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* The floating chat widget has been permanently removed from here! */}
        {children}
      </body>
    </html>
  );
}
