'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Train, Clock, MapPinned } from 'lucide-react';
import { calculateRoute } from '@/lib/utils/googleMaps';
import { useAuth } from '@/lib/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Create a wrapper component that imports the CSS
const MapWithNoSSR = dynamic(
  () => import('./MapComponent').then((mod) => mod.default),
  { ssr: false }
);

interface PropertyMapProps {
  postcode: string;
  address?: string;
}

interface RouteInfo {
  duration: string;
  distance: string;
}

export default function PropertyMap({ postcode, address }: PropertyMapProps) {
  const { user } = useAuth();
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [workplaceAddress, setWorkplaceAddress] = useState<string | null>(null);

  // Fetch user's workplace address
  useEffect(() => {
    const fetchWorkplaceAddress = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.workplaceAddress) {
            setWorkplaceAddress(userData.workplaceAddress);
          }
        }
      } catch (err) {
        console.error('Error fetching workplace address:', err);
      }
    };
    
    fetchWorkplaceAddress();
  }, [user]);

  useEffect(() => {
    const fetchCoordinates = async () => {
      if (!postcode || !workplaceAddress) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
        const data = await response.json();
        
        if (data.status === 200 && data.result) {
          setCoordinates([data.result.latitude, data.result.longitude]);
          
          // Calculate route to user's workplace instead of Parliament
          const routeData = await calculateRoute(postcode, workplaceAddress);
          setRouteInfo(routeData);
        } else {
          throw new Error('Could not find coordinates for this postcode');
        }
      } catch (err) {
        setError('Property location could not be determined');
        setCoordinates(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (postcode && workplaceAddress) {
      fetchCoordinates();
    }
  }, [postcode, workplaceAddress]);

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workplaceAddress) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto text-gray-400" size={32} />
          <p className="mt-2 text-gray-600">Please set your workplace address in settings</p>
        </div>
      </div>
    );
  }

  if (error || !coordinates) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto text-gray-400" size={32} />
          <p className="mt-2 text-gray-600">{error || 'Location not available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <MapWithNoSSR coordinates={coordinates} address={address} postcode={postcode} />
      {routeInfo && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-700">
              <Train className="text-blue-600 mr-2" size={18} />
              <span className="text-sm font-medium">To Workplace</span>
            </div>
            <div className="flex items-center text-gray-700">
              <Clock className="text-blue-600 mr-2" size={18} />
              <span className="text-sm">{routeInfo.duration}</span>
            </div>
            <div className="flex items-center text-gray-700">
              <MapPinned className="text-blue-600 mr-2" size={18} />
              <span className="text-sm">{routeInfo.distance}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}