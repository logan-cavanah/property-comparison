import './globals.css';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Home, Plus, GitCompare, Trophy } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Property Comparison App',
  description: 'Compare properties with friends',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="bg-blue-600 text-white p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold flex items-center">
              <Home className="mr-2" size={24} />
              Property Comparison
            </Link>
            <div className="flex space-x-4">
              <Link href="/add" className="flex items-center hover:bg-blue-700 p-2 rounded">
                <Plus className="mr-1" size={20} />
                Add
              </Link>
              <Link href="/compare" className="flex items-center hover:bg-blue-700 p-2 rounded">
                <GitCompare className="mr-1" size={20} />
                Compare
              </Link>
              <Link href="/rankings" className="flex items-center hover:bg-blue-700 p-2 rounded">
                <Trophy className="mr-1" size={20} />
                Rankings
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
