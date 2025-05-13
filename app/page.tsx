'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Trophy, ExternalLink } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Property } from '@/lib/types';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [personalRankings, setPersonalRankings] = useState<{ id: string; rank: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch all properties
        const propertiesSnapshot = await getDocs(collection(db, 'properties'));
        const allProperties = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Property));
        setProperties(allProperties);

        // Fetch personal rankings
        const rankingsSnapshot = await getDocs(collection(db, `users/${user.uid}/rankings`));
        if (!rankingsSnapshot.empty) {
          const ranking = rankingsSnapshot.docs[0].data();
          const orderedIds = ranking.orderedPropertyIds || [];
          setPersonalRankings(
            orderedIds.map((id: string, index: number) => ({ id, rank: index + 1 }))
          );
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      await deleteDoc(doc(db, 'properties', propertyId));
      setProperties(properties.filter(p => p.id !== propertyId));
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-700 font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-extrabold text-gray-900">
            Property Comparison Dashboard
          </h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">
                {user.displayName || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Personal Rankings */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rankings</h2>
          {personalRankings.length === 0 ? (
            <p className="text-gray-600 font-medium">
              No rankings yet. Start comparing properties <Link href="/compare" className="text-blue-600 hover:underline">here</Link>.
            </p>
          ) : (
            <ul className="space-y-2">
              {personalRankings.map((item) => {
                const property = properties.find(p => p.id === item.id);
                return (
                  <li key={item.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      {item.rank === 1 && <Trophy className="text-yellow-500 mr-2" size={18} />}
                      {item.rank === 2 && <Trophy className="text-gray-400 mr-2" size={18} />}
                      {item.rank === 3 && <Trophy className="text-yellow-700 mr-2" size={18} />}
                      <span className="text-sm font-medium text-gray-900">
                        {item.rank}. {property ? `${property.site}: ${property.propertyId}` : 'Unknown Property'}
                      </span>
                    </div>
                    <a
                      href={property?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/compare"
            className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Compare More
          </Link>
        </div>

        {/* Property List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">All Properties</h2>
            <Link
              href="/add"
              className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <Plus size={18} className="mr-2" /> Add Property
            </Link>
          </div>
          {properties.length === 0 ? (
            <p className="text-gray-600 font-medium">No properties added yet.</p>
          ) : (
            <ul className="space-y-2">
              {properties.map((property) => (
                <li key={property.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {property.site}: {property.propertyId}
                    </span>
                    <p className="text-sm text-gray-500">Added by {property.addedBy}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={property.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button
                      onClick={() => handleDeleteProperty(property.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}