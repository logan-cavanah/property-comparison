'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trophy, RefreshCw, AlertCircle, Home as HomeIcon, Bed, Bath, PoundSterling, MapPin, Users } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AddPropertyModal from '@/components/AddPropertyModal';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Property, User } from '@/lib/types';
import { collection, getDocs, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { resetUserComparisonsAndRankings } from '@/lib/utils';
import toast, { Toaster } from 'react-hot-toast';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [personalRankings, setPersonalRankings] = useState<{ id: string; rank: number }[]>([]);
  const [unrankedProperties, setUnrankedProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<{ groupId: string; groupName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Get user's group
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        if (!userData?.groupId) {
          setError('You are not part of a group yet. Please join or create a group to view properties.');
          setIsLoading(false);
          return;
        }
        
        // Get group name
        const groupDoc = await getDoc(doc(db, 'groups', userData.groupId));
        if (!groupDoc.exists()) {
          console.error('Group document does not exist:', userData.groupId);
          setError('Your group no longer exists. Please join or create a new group.');
          setIsLoading(false);
          return;
        }
        const groupData = groupDoc.data();
        
        setUserData({
          groupId: userData.groupId,
          groupName: groupData?.name || 'Your Group'
        });
        
        // Get properties from user's group
        const propertiesPath = `groups/${userData.groupId}/properties`;
        const propertiesSnapshot = await getDocs(collection(db, propertiesPath));
        const propertiesData = propertiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Property));
        
        setProperties(propertiesData);

        // Fetch personal rankings
        const rankingsSnapshot = await getDocs(collection(db, `users/${user.uid}/rankings`));
        if (!rankingsSnapshot.empty) {
          const ranking = rankingsSnapshot.docs[0].data();
          const orderedIds = ranking.orderedPropertyIds || [];
          
          // Filter out any property IDs that don't exist in propertiesData
          const validPropertyIds = orderedIds.filter((id: string) => 
            propertiesData.some(property => property.id === id)
          );
          
          setPersonalRankings(
            validPropertyIds.map((id: string, index: number) => ({ id, rank: index + 1 }))
          );

          // Find unranked properties
          const rankedIds = new Set(validPropertyIds);
          setUnrankedProperties(propertiesData.filter(property => !rankedIds.has(property.id)));
        } else {
          // If no rankings exist, all properties are unranked
          setUnrankedProperties(propertiesData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load properties. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      // Get user's group
      const userDoc = await getDoc(doc(db, 'users', user!.uid));
      const userData = userDoc.data() as User;
      if (!userData.groupId) {
        throw new Error('User is not in a group');
      }

      // Delete the property from the group's subcollection
      await deleteDoc(doc(db, `groups/${userData.groupId}/properties`, propertyId));

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

  const handleAddPropertySuccess = () => {
    // Refresh the data after adding a property
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-700 font-medium">Loading properties...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No Group Found</h3>
        <p className="mt-2 text-gray-600">You need to join or create a group to start comparing properties.</p>
        <div className="mt-6">
          <Link
            href="/settings"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Users className="mr-2 h-5 w-5" />
            Go to Settings
          </Link>
        </div>
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
                          <HomeIcon size={48} className="text-gray-400" />
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
                            <HomeIcon size={14} className="mr-1" />
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Rankings</h2>
          {personalRankings.length === 0 ? (
            <p className="text-gray-600 font-medium">
              No rankings yet. Start comparing properties <Link href="/compare" className="text-blue-600 hover:underline">here</Link>.
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {personalRankings.map((item) => {
                  const property = properties.find(p => p.id === item.id);
                  if (!property) return null;
                  
                  return (
                    <Link href={`/property/${item.id}`} key={item.id} className="block py-6 first:pt-0 last:pb-0">
                      <div className="bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer relative flex">
                        <div className="flex-grow flex">
                          <div className="w-48 h-32 flex-shrink-0 relative">
                            {property.images && property.images.length > 0 ? (
                              <img 
                                src={property.images[0]} 
                                alt={property.address || property.postcode || 'Property'} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full bg-gray-100">
                                <HomeIcon size={32} className="text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-grow p-4 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                  <span className="text-2xl font-bold text-blue-600">
                                    #{item.rank}
                                  </span>
                                  {item.rank <= 3 && (
                                    <Trophy 
                                      className={
                                        item.rank === 1 ? "text-yellow-500" : 
                                        item.rank === 2 ? "text-gray-400" : 
                                        "text-yellow-700"
                                      } 
                                      size={24} 
                                    />
                                  )}
                                  <h3 className="font-medium text-gray-900 text-lg">
                                    {property.address || property.postcode || `${property.site}: ${property.propertyId}`}
                                  </h3>
                                </div>
                                {property.price && (
                                  <div className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                                    <PoundSterling size={16} className="mr-1" />
                                    <span>{property.price} {property.priceFrequency || 'pcm'}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center text-gray-600 text-sm mb-2">
                                <MapPin size={14} className="mr-1" />
                                <span>{property.postcode || 'Location not specified'}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-6 text-sm text-gray-700">
                              {property.bedrooms && (
                                <div className="flex items-center">
                                  <Bed size={16} className="mr-1" />
                                  <span>{property.bedrooms} beds</span>
                                </div>
                              )}
                              {property.bathrooms && (
                                <div className="flex items-center">
                                  <Bath size={16} className="mr-1" />
                                  <span>{property.bathrooms} baths</span>
                                </div>
                              )}
                              {property.propertyType && (
                                <div className="flex items-center">
                                  <HomeIcon size={16} className="mr-1" />
                                  <span>{property.propertyType}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <button
                onClick={handleReorderRankings}
                className="mt-6 flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <RefreshCw size={18} className="mr-2" /> Reorder Rankings
              </button>
            </>
          )}
        </div>

        {/* Add Property Button */}
        <div className="flex justify-center">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <Plus size={20} className="mr-2" /> Add New Property
          </button>
        </div>

        {/* Add Property Modal */}
        <AddPropertyModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={handleAddPropertySuccess}
        />

        {/* Toast notifications */}
        <Toaster position="top-center" />
      </div>
    </ProtectedRoute>
  );
}
