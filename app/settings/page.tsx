'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { LogOut, User as UserIcon } from 'lucide-react';
import AddressInput from '../components/AddressInput';

export default function Settings() {
  const { user } = useAuth();
  const router = useRouter();
  
  // User profile state
  const [displayName, setDisplayName] = useState('');
  const [workplaceAddress, setWorkplaceAddress] = useState('');
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', message: '' });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setDisplayName(userData.displayName || '');
          setWorkplaceAddress(userData.workplaceAddress || '');
          // If address exists, assume it's valid
          if (userData.workplaceAddress) {
            setIsAddressValid(true);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    if (workplaceAddress && !isAddressValid) {
      setSaveMessage({ type: 'error', message: 'Please select a valid workplace address from the suggestions.' });
      return;
    }
    
    setIsSaving(true);
    setSaveMessage({ type: '', message: '' });
    
    try {
      const updateData: any = {
        displayName,
        updatedAt: Date.now()
      };

      // Only update workplace address if it's provided and valid
      if (workplaceAddress && isAddressValid) {
        updateData.workplaceAddress = workplaceAddress;
      } else if (!workplaceAddress) {
        // Clear workplace address if empty
        updateData.workplaceAddress = '';
        updateData.workplaceLatitude = null;
        updateData.workplaceLongitude = null;
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);
      
      setSaveMessage({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveMessage({ type: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        
        {/* User Profile Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <UserIcon className="mr-2" size={24} />
            Profile Settings
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                placeholder="Your display name"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 placeholder-gray-500"
              />
              <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
            </div>
            
            <AddressInput
              value={workplaceAddress}
              onChange={setWorkplaceAddress}
              onValidityChange={setIsAddressValid}
              label="Workplace Address"
              placeholder="Enter your workplace address"
              helperText="This will help calculate commute times to properties and show your location on the team map"
            />
            
            {saveMessage.message && (
              <div className={`p-3 rounded-md ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {saveMessage.message}
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              
              <button
                onClick={handleSignOut}
                className="flex items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                <LogOut size={18} className="mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
        
        {/* Group Management Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Group Management</h2>
          <p className="text-gray-700 mb-4">
            Group management has been moved to its own dedicated page for better organization and enhanced features.
          </p>
          <button
            onClick={() => router.push('/group')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Group Page
          </button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
