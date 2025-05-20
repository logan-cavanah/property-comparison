'use client';

import { useEffect, useRef } from 'react';
import { createMap, createMarker } from '@/lib/utils/googleMaps';

interface MapComponentProps {
  coordinates: [number, number];
  address?: string;
  postcode: string;
}

export default function MapComponent({ coordinates, address, postcode }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !coordinates) return;

    const initMap = async () => {
      try {
        const map = await createMap(mapRef.current!, {
          lat: coordinates[0],
          lng: coordinates[1]
        });

        mapInstanceRef.current = map;

        await createMarker(
          { lat: coordinates[0], lng: coordinates[1] },
          map,
          address || postcode
        );
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();
  }, [coordinates, address, postcode]);

  return (
    <div className="h-64 rounded-lg overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
} 