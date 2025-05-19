'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

// Create a wrapper component that imports the CSS
const MapWithNoSSR = dynamic(
  () => import('./MapComponent').then((mod) => mod.default),
  { ssr: false }
);

interface PropertyMapProps {
  postcode: string;
  address?: string;
}

export default function PropertyMap({ postcode, address }: PropertyMapProps) {
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
        const data = await response.json();
        
        if (data.status === 200 && data.result) {
          setCoordinates([data.result.latitude, data.result.longitude]);
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

    if (postcode) {
      fetchCoordinates();
    }
  }, [postcode]);

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

  return <MapWithNoSSR coordinates={coordinates} address={address} postcode={postcode} />;
} 