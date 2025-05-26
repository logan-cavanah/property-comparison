import './globals.css';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Home, Plus, GitCompare, Trophy, RefreshCw, Settings, Users } from 'lucide-react';
import { AuthProvider } from '@/lib/AuthContext';


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
        <AuthProvider>
        <nav className="bg-blue-600 text-white p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold flex items-center hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors duration-200">
              <Home className="mr-2" size={24} />
              Property Comparison
            </Link>
            <div className="flex space-x-2">
              <Link href="/compare" className="flex items-center hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors duration-200 font-medium">
                <GitCompare className="mr-2" size={20} />
                Compare
              </Link>
              <Link href="/rankings" className="flex items-center hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors duration-200 font-medium">
                <Trophy className="mr-2" size={20} />
                Rankings
              </Link>
              <Link href="/group" className="flex items-center hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors duration-200 font-medium">
                <Users className="mr-2" size={20} />
                Group
              </Link>
              <Link href="/settings" className="flex items-center hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors duration-200 font-medium">
                <Settings className="mr-2" size={20} />
                Settings
              </Link>
            </div>
          </div>
        </nav>
          <main className="max-w-6xl mx-auto p-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
