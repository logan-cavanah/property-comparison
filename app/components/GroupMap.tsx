'use client';

import { useEffect, useRef, useState } from 'react';
import { createMap, createMarker, loader } from '@/lib/utils/googleMaps';
import { User } from '@/lib/types';

interface GroupMapProps {
  members: (User & { id: string })[];
}

interface MemberLocation {
  id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
}

export default function GroupMap({ members }: GroupMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemberLocations = async () => {
      if (!members.length) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { Geocoder } = await loader.importLibrary('geocoding');
        const geocoder = new Geocoder();
        
        const locations = await Promise.all(
          members
            .filter(member => member.workplaceAddress)
            .map(async (member) => {
              try {
                const response = await geocoder.geocode({ address: member.workplaceAddress });
                if (response.results.length > 0) {
                  const location = response.results[0].geometry.location;
                  return {
                    id: member.id,
                    name: member.displayName || member.email || 'Unknown',
                    address: member.workplaceAddress,
                    coordinates: { lat: location.lat(), lng: location.lng() }
                  };
                }
                return null;
              } catch (err) {
                console.error(`Error geocoding address for ${member.id}:`, err);
                return null;
              }
            })
        );
        
        setMemberLocations(locations.filter(Boolean) as MemberLocation[]);
      } catch (err) {
        console.error('Error fetching member locations:', err);
        setError('Failed to load team member locations');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMemberLocations();
  }, [members]);

  useEffect(() => {
    if (!mapRef.current || !memberLocations.length) return;
    
    const initMap = async () => {
      try {
        // Calculate center point (average of all locations)
        const center = memberLocations.reduce(
          (acc, loc) => {
            return {
              lat: acc.lat + loc.coordinates.lat / memberLocations.length,
              lng: acc.lng + loc.coordinates.lng / memberLocations.length
            };
          },
          { lat: 0, lng: 0 }
        );
        
        const map = await createMap(mapRef.current!, center, 10);
        
        // Create markers for each member
        for (const location of memberLocations) {
          await createMarker(
            location.coordinates,
            map,
            `${location.name}: ${location.address}`
          );
        }
        
        // Adjust zoom to fit all markers
        if (memberLocations.length > 1) {
          const bounds = new google.maps.LatLngBounds();
          memberLocations.forEach(loc => {
            bounds.extend(loc.coordinates);
          });
          map.fitBounds(bounds);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
        setError('Failed to initialize map');
      }
    };
    
    initMap();
  }, [memberLocations]);

  if (isLoading) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || memberLocations.length === 0) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="mt-2 text-gray-600">
            {error || 'No workplace locations available for team members'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-96 rounded-lg overflow-hidden border border-gray-300">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}