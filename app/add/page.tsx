'use client';

import { useState, useEffect } from 'react';
import { addProperty, extractPropertyInfo } from '@/lib/utils';
import toast, { Toaster } from 'react-hot-toast';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { collection, doc, getDoc, query, setDoc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';

export default function AddProperty() {
  const { user } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [userGroup, setUserGroup] = useState<{id: string, name: string} | null>(null);
  const [isCheckingGroup, setIsCheckingGroup] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user) return;
      
      setIsCheckingGroup(true);
      
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUserDisplayName(userData.displayName);
        }
        
        // Check if user belongs to a group
        const groupsQuery = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
        const groupsSnapshot = await getDocs(groupsQuery);
        
        if (!groupsSnapshot.empty) {
          // User is in a group
          const groupDoc = groupsSnapshot.docs[0];
          setUserGroup({
            id: groupDoc.id,
            name: groupDoc.data().name
          });
        } else {
          // User is not in a group
          setUserGroup(null);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      } finally {
        setIsCheckingGroup(false);
      }
    };

    fetchUserInfo();
  }, [user]);

  // Function to normalize URL for preview
  const normalizeUrl = (input: string) => {
    if (!input) return '';
    
    try {
      const urlObj = new URL(input);
      let cleanPath = urlObj.pathname;
      
      // Remove tracking parameters and unnecessary parts
      if (urlObj.hostname.includes('rightmove.co.uk')) {
        // For Rightmove: keep only /properties/[id]
        const match = cleanPath.match(/\/properties\/(\d+)/);
        if (match) {
          return `https://www.rightmove.co.uk/properties/${match[1]}`;
        }
      } else if (urlObj.hostname.includes('zoopla.co.uk')) {
        // For Zoopla: keep only /to-rent/details/[id]
        const match = cleanPath.match(/\/to-rent\/details\/(\d+)/);
        if (match) {
          return `https://www.zoopla.co.uk/to-rent/details/${match[1]}`;
        }
      } else if (urlObj.hostname.includes('spareroom.co.uk')) {
        // For SpareRoom: keep only /flatshare/flatshare_detail.pl?flatshare_id=[id]
        const searchParams = new URLSearchParams(urlObj.search);
        const flatshareId = searchParams.get('flatshare_id');
        if (flatshareId) {
          return `https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=${flatshareId}`;
        }
      }
      
      // For other sites, just remove query parameters and fragments
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      return input;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setPreviewUrl(normalizeUrl(newUrl));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }
  
    if (!user) {
      toast.error('Please sign in to add properties');
      router.push('/login');
      return;
    }
  
    if (!userDisplayName) {
      toast.error('Unable to get user information. Please try again.');
      return;
    }
    
    // Check if user belongs to a group
    if (!userGroup) {
      toast.error('You need to join or create a group to add properties');
      router.push('/settings');
      return;
    }
  
    const normalizedUrl = normalizeUrl(url);  // Use existing normalization
    setIsLoading(true);
    
    try {
      // Call the scrape API to get detailed property data
      const scrapeResponse = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });
  
      if (!scrapeResponse.ok) {
        throw new Error('Failed to scrape property data');
      }
  
      const scrapedData = await scrapeResponse.json();
      
      // Extract the site and property ID
      const propertyInfo = extractPropertyInfo(normalizedUrl);
      
      // Check if property already exists in this group
      const existingPropertiesQuery = query(
        collection(db, `groups/${userGroup.id}/properties`),
        where('site', '==', propertyInfo.site),
        where('propertyId', '==', propertyInfo.propertyId)
      );
      const existingPropertiesSnapshot = await getDocs(existingPropertiesQuery);
      
      if (!existingPropertiesSnapshot.empty) {
        toast.error('This property has already been added to your group', {
          icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
        });
        setIsLoading(false);
        return;
      }
      
      // Prepare full property data by merging scraped info with basics
      const propertyData = {
        ...scrapedData,  // Use scraped fields (e.g., description, images, price)
        url: normalizedUrl,  // Override with normalized URL
        addedBy: userDisplayName,
        addedAt: Date.now(),
        userId: user.uid,
        site: scrapedData.site || propertyInfo.site,  // Fallback to extraction
        propertyId: scrapedData.propertyId || propertyInfo.propertyId,
        groupId: userGroup.id  // Add the group ID
      };
  
      // Save the full scraped data to Firestore as a subcollection of the group
      const propertyRef = doc(db, `groups/${userGroup.id}/properties`, `${propertyData.site}_${propertyData.propertyId}`);
      await setDoc(propertyRef, propertyData);
  
      toast.success('Property added and scraped successfully!');
      setUrl('');
      setPreviewUrl('');
      router.push('/');  // Route to home page after success
    } catch (error) {
      console.error('Error adding and scraping property:', error);
      if (error instanceof Error && error.message === 'This property already exists in the group') {
        toast.error('This property has already been added to your group', {
          icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
        });
      } else {
        // Fallback: If scraping fails, add basic data
        try {
          if (userGroup) {
            await addProperty(url, userDisplayName, user.uid, userGroup.id);
            toast.success('Property added (scraping failed, basic info saved)');
            router.push('/');
          } else {
            toast.error('You need to join or create a group to add properties');
            router.push('/settings');
          }
        } catch (fallbackError) {
          toast.error('Failed to add property. Please try again.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto">
        <Toaster position="top-center" />
        
        {isCheckingGroup ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-700 font-medium">Checking group membership...</p>
          </div>
        ) : !userGroup ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h1 className="text-2xl font-bold mb-4">Group Membership Required</h1>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md mb-6">
              <p className="text-yellow-800">
                You need to join or create a group before you can add properties.
              </p>
            </div>
            <p className="text-gray-600 mb-6">
              Properties are shared within groups, allowing everyone in your group to view and compare them.
            </p>
            <button
              onClick={() => router.push('/settings')}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Settings
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-6">Add Property</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-md mb-4">
                <p className="text-blue-800 text-sm">
                  Adding property to group: <span className="font-medium">{userGroup.name}</span>
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                    Property URL
                  </label>
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={handleUrlChange}
                    placeholder="https://www.rightmove.co.uk/properties/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  
                  {previewUrl && previewUrl !== url && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-800 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        URL will be cleaned to: <span className="font-medium ml-1">{previewUrl}</span>
                      </p>
                      {(() => {
                        const info = extractPropertyInfo(previewUrl);
                        return (
                          <p className="text-sm text-blue-600 mt-1">
                            Will appear as: "{info.site}: {info.propertyId}"
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Property'
                  )}
                </button>
              </form>
              
              <div className="mt-6 text-sm text-gray-600">
                <p className="font-medium mb-2">How URL normalization works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Removes tracking parameters</li>
                  <li>Extracts only the essential property ID</li>
                  <li>Prevents duplicate properties with different URLs</li>
                  <li>Supports Rightmove, Zoopla, and SpareRoom</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}