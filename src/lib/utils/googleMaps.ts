import { Loader } from '@googlemaps/js-api-loader';

// Initialize the Google Maps loader
export const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_JAVASCRIPT_KEY!,
  version: 'weekly',
  libraries: ['places', 'routes', 'marker', 'maps'],
  language: 'en-GB',
  region: 'GB'
});

// Houses of Parliament coordinates
export const HOUSES_OF_PARLIAMENT = {
  lat: 51.499633,
  lng: -0.124755,
  address: 'Houses of Parliament, London SW1A 0AA'
};

// Function to create a map instance
export const createMap = async (
  element: HTMLElement,
  center: { lat: number; lng: number },
  zoom: number = 15
) => {
  const { Map } = await loader.importLibrary('maps');
  return new Map(element, {
    center,
    zoom,
    mapId: 'property_map',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });
};

// Function to create a marker using AdvancedMarkerElement
export const createMarker = async (
  position: { lat: number; lng: number },
  map: google.maps.Map,
  title?: string
) => {
  const { AdvancedMarkerElement } = await loader.importLibrary('marker');
  
  // Create a custom marker element
  const markerView = new google.maps.marker.PinElement({
    background: '#FF0000',
    borderColor: '#FF0000',
    glyphColor: '#FFFFFF',
    scale: 1.5,
  });

  // Create the advanced marker
  const marker = new AdvancedMarkerElement({
    map,
    position,
    title,
    content: markerView.element,
  });

  return marker;
};

// Function to calculate route and travel time
export const calculateRoute = async (
  origin: string,
  destination: string = HOUSES_OF_PARLIAMENT.address
) => {
  try {
    const response = await fetch('/api/google-maps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin, destination }),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate route');
    }

    return await response.json();
  } catch (error) {
    console.error('Error calculating route:', error);
    throw error;
  }
}; 