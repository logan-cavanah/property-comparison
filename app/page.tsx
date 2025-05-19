'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trophy, RefreshCw, AlertCircle, Home, Bed, Bath, PoundSterling, MapPin } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Property } from '@/lib/types';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { resetUserComparisonsAndRankings } from '@/lib/utils';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [personalRankings, setPersonalRankings] = useState<{ id: string; rank: number }[]>([]);
  const [unrankedProperties, setUnrankedProperties] = useState<Property[]>([]);
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
          
          // Filter out any property IDs that don't exist in allProperties
          const validPropertyIds = orderedIds.filter((id: string) => 
            allProperties.some(property => property.id === id)
          );
          
          setPersonalRankings(
            validPropertyIds.map((id: string, index: number) => ({ id, rank: index + 1 }))
          );

          // Find unranked properties
          const rankedIds = new Set(validPropertyIds);
          setUnrankedProperties(allProperties.filter(property => !rankedIds.has(property.id)));
        } else {
          // If no rankings exist, all properties are unranked
          setUnrankedProperties(allProperties);
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
      // Delete the property
      await deleteDoc(doc(db, 'properties', propertyId));

      // Get all users to clean up their rankings
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      // For each user, update their rankings to remove the deleted property
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const rankingsSnapshot = await getDocs(collection(db, `users/${userId}/rankings`));
        
        // Update each ranking document
        for (const rankingDoc of rankingsSnapshot.docs) {
          const ranking = rankingDoc.data();
          const updatedOrderedIds = ranking.orderedPropertyIds.filter((id: string) => id !== propertyId);
          
          // Update the ranking document with the filtered IDs
          await setDoc(doc(db, `users/${userId}/rankings`, rankingDoc.id), {
            ...ranking,
            orderedPropertyIds: updatedOrderedIds,
            lastUpdated: Date.now()
          });
        }
      }

      // Update local state
      setProperties(properties.filter(p => p.id !== propertyId));
      setPersonalRankings(personalRankings.filter(p => p.id !== propertyId));
      setUnrankedProperties(unrankedProperties.filter(p => p.id !== propertyId));
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  const handleReorderRankings = async () => {
    if (!user) return;
    if (!confirm('This will reset your current rankings. You will need to compare properties again. Continue?')) return;
    
    try {
      await resetUserComparisonsAndRankings(user.uid);
      router.push('/compare');
    } catch (error) {
      console.error('Error resetting rankings:', error);
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
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-extrabold text-white-900">
            Property Finder
          </h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-white-700 font-medium">
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

        {/* Unranked Properties */}
        {unrankedProperties.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-400">
            <div className="flex items-center mb-4">
              <AlertCircle className="text-yellow-500 mr-2" size={24} />
              <h2 className="text-2xl font-bold text-gray-900">New Properties to Rank!</h2>
            </div>
            <p className="text-gray-600 font-medium mb-4">
              You have {unrankedProperties.length} new properties that need to be ranked. Start comparing them now!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {unrankedProperties.map((property) => (
                <Link href={`/property/${property.id}`} key={property.id}>
                  <div className="bg-gray-50 rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow cursor-pointer h-full">
                    <div className="h-40 bg-gray-200 relative">
                      {property.images && property.images.length > 0 ? (
                        <img 
                          src={property.images[0]} 
                          alt={property.address || property.postcode || 'Property'} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Home size={48} className="text-gray-400" />
                        </div>
                      )}
                      {property.price && (
                        <div className="absolute bottom-0 left-0 bg-blue-600 text-white px-3 py-1 flex items-center">
                          <PoundSterling size={16} className="mr-1" />
                          <span>{property.price} {property.priceFrequency || 'pcm'}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 mb-1 truncate">
                        {property.address || property.postcode || `${property.site}: ${property.propertyId}`}
                      </h3>
                      <div className="flex items-center text-gray-600 text-sm mb-2">
                        <MapPin size={14} className="mr-1" />
                        <span>{property.postcode || 'Location not specified'}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-700">
                        {property.bedrooms && (
                          <div className="flex items-center">
                            <Bed size={14} className="mr-1" />
                            <span>{property.bedrooms}</span>
                          </div>
                        )}
                        {property.bathrooms && (
                          <div className="flex items-center">
                            <Bath size={14} className="mr-1" />
                            <span>{property.bathrooms}</span>
                          </div>
                        )}
                        {property.propertyType && (
                          <div className="flex items-center">
                            <Home size={14} className="mr-1" />
                            <span>{property.propertyType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            <Link
              href="/compare"
              className="inline-block bg-yellow-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-600 transition-colors"
            >
              Start Ranking
            </Link>
          </div>
        )}

        {/* Personal Rankings */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rankings</h2>
          {personalRankings.length === 0 ? (
            <p className="text-gray-600 font-medium">
              No rankings yet. Start comparing properties <Link href="/compare" className="text-blue-600 hover:underline">here</Link>.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {personalRankings.map((item) => {
                  const property = properties.find(p => p.id === item.id);
                  if (!property) return null;
                  
                  return (
                    <Link href={`/property/${item.id}`} key={item.id}>
                      <div className="bg-gray-50 rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow cursor-pointer h-full relative">
                        <div className="absolute top-0 left-0 bg-blue-600 text-white w-8 h-8 flex items-center justify-center font-bold z-10">
                          {item.rank}
                        </div>
                        {item.rank <= 3 && (
                          <div className="absolute top-2 right-2 z-10">
                            <Trophy 
                              className={
                                item.rank === 1 ? "text-yellow-500" : 
                                item.rank === 2 ? "text-gray-400" : 
                                "text-yellow-700"
                              } 
                              size={24} 
                            />
                          </div>
                        )}
                        <div className="h-40 bg-gray-200 relative">
                          {property.images && property.images.length > 0 ? (
                            <img 
                              src={property.images[0]} 
                              alt={property.address || property.postcode || 'Property'} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Home size={48} className="text-gray-400" />
                            </div>
                          )}
                          {property.price && (
                            <div className="absolute bottom-0 left-0 bg-blue-600 text-white px-3 py-1 flex items-center">
                              <PoundSterling size={16} className="mr-1" />
                              <span>{property.price} {property.priceFrequency || 'pcm'}</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-medium text-gray-900 mb-1 truncate">
                            {property.address || property.postcode || `${property.site}: ${property.propertyId}`}
                          </h3>
                          <div className="flex items-center text-gray-600 text-sm mb-2">
                            <MapPin size={14} className="mr-1" />
                            <span>{property.postcode || 'Location not specified'}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-700">
                            {property.bedrooms && (
                              <div className="flex items-center">
                                <Bed size={14} className="mr-1" />
                                <span>{property.bedrooms}</span>
                              </div>
                            )}
                            {property.bathrooms && (
                              <div className="flex items-center">
                                <Bath size={14} className="mr-1" />
                                <span>{property.bathrooms}</span>
                              </div>
                            )}
                            {property.propertyType && (
                              <div className="flex items-center">
                                <Home size={14} className="mr-1" />
                                <span>{property.propertyType}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={handleReorderRankings}
                className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <RefreshCw size={18} className="mr-2" /> Reorder Rankings
              </button>
            </>
          )}
        </div>

        {/* Add Property Button */}
        <div className="flex justify-center">
          <Link
            href="/add"
            className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <Plus size={20} className="mr-2" /> Add New Property
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
