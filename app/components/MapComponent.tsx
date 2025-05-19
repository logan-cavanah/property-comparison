'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  coordinates: [number, number];
  address?: string;
  postcode: string;
}

export default function MapComponent({ coordinates, address, postcode }: MapComponentProps) {
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  if (!L) {
    return null;
  }

  // Create custom marker icon
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative">
        <svg viewBox="0 0 24 24" class="w-8 h-8 text-red-600">
          <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-600 rounded-full"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  return (
    <div className="h-64 rounded-lg overflow-hidden">
      <MapContainer
        center={coordinates}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={coordinates} icon={customIcon}>
          <Popup>
            {address || postcode}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
} 