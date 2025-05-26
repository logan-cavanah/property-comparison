'use client';

import { useEffect, useRef, useState } from 'react';
import { createMap, createUserMarker, createPropertyMarker, loader } from '@/lib/utils/googleMaps';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Property } from '@/lib/types';

interface GroupMapProps {
  members: (User & { id: string })[];
  properties?: Property[];
}

interface MemberLocation {
  id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  user: User & { id: string };
}

interface PropertyLocation {
  id: string;
  address: string;
  coordinates: { lat: number; lng: number };
  price?: number;
  priceFrequency?: string;
  property: Property;
}

export default function GroupMap({ members, properties = [] }: GroupMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [propertyLocations, setPropertyLocations] = useState<PropertyLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cleanup function for map and markers
  const cleanupMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current = null;
    }
    markersRef.current.forEach(marker => marker.map = null);
    markersRef.current = [];
  };

  useEffect(() => {
    const fetchLocations = async () => {
      if (!members.length && !properties.length) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { Geocoder } = await loader.importLibrary('geocoding');
        const geocoder = new Geocoder();
        
        // Process member locations
        const memberLocationPromises = members
          .filter(member => member.workplaceAddress)
          .map(async (member) => {
            try {
              // Check if we already have coordinates saved
              if (member.workplaceLatitude && member.workplaceLongitude) {
                return {
                  id: member.id,
                  name: member.displayName || member.email || 'Unknown',
                  address: member.workplaceAddress!,
                  coordinates: { 
                    lat: member.workplaceLatitude, 
                    lng: member.workplaceLongitude 
                  },
                  user: member
                };
              }

              // Geocode the address
              const response = await geocoder.geocode({ address: member.workplaceAddress });
              if (response.results.length > 0) {
                const location = response.results[0].geometry.location;
                const coordinates = { lat: location.lat(), lng: location.lng() };
                
                // Save coordinates to user document
                try {
                  await updateDoc(doc(db, 'users', member.id), {
                    workplaceLatitude: coordinates.lat,
                    workplaceLongitude: coordinates.lng,
                    updatedAt: Date.now()
                  });
                } catch (updateError) {
                  console.error('Error saving user coordinates:', updateError);
                }
                
                return {
                  id: member.id,
                  name: member.displayName || member.email || 'Unknown',
                  address: member.workplaceAddress,
                  coordinates,
                  user: member
                };
              }
              return null;
            } catch (err) {
              console.error(`Error geocoding address for ${member.id}:`, err);
              return null;
            }
          });

        // Process property locations
        const propertyLocationPromises = properties
          .filter(property => property.address || property.postcode)
          .map(async (property) => {
            try {
              const address = property.address || property.postcode!;
              
              // Check if we already have coordinates saved
              if (property.latitude && property.longitude) {
                return {
                  id: property.id,
                  address,
                  coordinates: { 
                    lat: property.latitude, 
                    lng: property.longitude 
                  },
                  price: property.price,
                  priceFrequency: property.priceFrequency,
                  property
                };
              }

              // Geocode the address
              const response = await geocoder.geocode({ address });
              if (response.results.length > 0) {
                const location = response.results[0].geometry.location;
                const coordinates = { lat: location.lat(), lng: location.lng() };
                
                // Save coordinates to property document
                try {
                  await updateDoc(doc(db, `groups/${property.groupId}/properties`, property.id), {
                    latitude: coordinates.lat,
                    longitude: coordinates.lng,
                    lastScraped: Date.now()
                  });
                } catch (updateError) {
                  console.error('Error saving property coordinates:', updateError);
                }
                
                return {
                  id: property.id,
                  address,
                  coordinates,
                  price: property.price,
                  priceFrequency: property.priceFrequency,
                  property
                };
              }
              return null;
            } catch (err) {
              console.error(`Error geocoding address for property ${property.id}:`, err);
              return null;
            }
          });

        // Wait for all geocoding to complete
        const [memberResults, propertyResults] = await Promise.all([
          Promise.all(memberLocationPromises),
          Promise.all(propertyLocationPromises)
        ]);
        
        setMemberLocations(memberResults.filter(Boolean) as MemberLocation[]);
        setPropertyLocations(propertyResults.filter(Boolean) as PropertyLocation[]);
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Failed to load locations');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLocations();

    // Cleanup function
    return () => {
      cleanupMap();
    };
  }, [members, properties]);

  useEffect(() => {
    if (!mapRef.current || (memberLocations.length === 0 && propertyLocations.length === 0)) return;
    
    const initMap = async () => {
      try {
        // Clean up existing map and markers
        cleanupMap();
        
        // Calculate center point (average of all locations)
        const allLocations = [...memberLocations, ...propertyLocations];
        const center = allLocations.reduce(
          (acc, loc) => {
            return {
              lat: acc.lat + loc.coordinates.lat / allLocations.length,
              lng: acc.lng + loc.coordinates.lng / allLocations.length
            };
          },
          { lat: 0, lng: 0 }
        );
        
        const map = await createMap(mapRef.current!, center, 10);
        mapInstanceRef.current = map;
        
        // Create markers for each member
        for (const location of memberLocations) {
          const marker = await createUserMarker(
            location.coordinates,
            map,
            location.user,
            `${location.name}: ${location.address}`
          );
          markersRef.current.push(marker);
        }

        // Create markers for each property
        for (const location of propertyLocations) {
          const priceText = location.price 
            ? `£${location.price} ${location.priceFrequency || 'pcm'}`
            : '';
          const marker = await createPropertyMarker(
            location.coordinates,
            map,
            location.property,
            `${location.address}${priceText ? ` - ${priceText}` : ''}`
          );
          markersRef.current.push(marker);
        }
        
        // Adjust zoom to fit all markers
        if (allLocations.length > 1) {
          const bounds = new google.maps.LatLngBounds();
          allLocations.forEach(loc => {
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
  }, [memberLocations, propertyLocations]);

  if (isLoading) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || (memberLocations.length === 0 && propertyLocations.length === 0)) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="mt-2 text-gray-600">
            {error || 'No locations available to display'}
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
