// app/page.tsx
'use client';


import Link from 'next/link';
import { Plus, GitCompare, Trophy } from 'lucide-react';
import ProtectedRoute from '@/src/components/ProtectedRoute';
import { useAuth } from '@/src/lib/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { useRouter } from 'next/navigation';


export default function Home() {
  const { user } = useAuth();
  const router = useRouter();


  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };


  return (
    <ProtectedRoute>
      <div className="text-center space-y-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Property Comparison App
          </h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                {user.displayName || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <Link 
            href="/add" 
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
          >
            <Plus className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-xl font-semibold mb-2">Add Properties</h2>
            <p className="text-gray-600">Add property URLs to the comparison pool</p>
          </Link>
          
          <Link 
            href="/compare" 
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
          >
            <GitCompare className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-xl font-semibold mb-2">Compare Properties</h2>
            <p className="text-gray-600">Choose between property pairs</p>
          </Link>
          
          <Link 
            href="/rankings" 
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
          >
            <Trophy className="mx-auto mb-4 text-blue-600" size={48} />
            <h2 className="text-xl font-semibold mb-2">View Rankings</h2>
            <p className="text-gray-600">See how properties rank</p>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}