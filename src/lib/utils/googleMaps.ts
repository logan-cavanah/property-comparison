import { Loader } from '@googlemaps/js-api-loader';

// Initialize the Google Maps loader
export const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_JAVASCRIPT_KEY!,
  version: 'weekly',
  libraries: ['places', 'routes', 'marker', 'maps'],
  language: 'en-GB',
  region: 'GB'
});

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

// Function to create a user marker with profile image
export const createUserMarker = async (
  position: { lat: number; lng: number },
  map: google.maps.Map,
  user: { photoURL?: string | null; displayName?: string; email: string },
  title?: string
) => {
  const { AdvancedMarkerElement } = await loader.importLibrary('marker');
  
  // Create a custom marker element with user's profile image
  const markerElement = document.createElement('div');
  markerElement.className = 'user-marker';
  markerElement.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid #4F46E5;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
  `;

  if (user.photoURL) {
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = user.displayName || user.email;
    img.style.cssText = `
      width: 34px;
      height: 34px;
      border-radius: 50%;
      object-fit: cover;
    `;
    markerElement.appendChild(img);
  } else {
    // Default user icon
    markerElement.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    `;
  }

  // Create the advanced marker
  const marker = new AdvancedMarkerElement({
    map,
    position,
    title,
    content: markerElement,
  });

  return marker;
};

// Function to create a property marker (house icon)
export const createPropertyMarker = async (
  position: { lat: number; lng: number },
  map: google.maps.Map,
  property: { price?: number; priceFrequency?: string; address?: string },
  title?: string
) => {
  const { AdvancedMarkerElement } = await loader.importLibrary('marker');
  
  // Create a custom marker element with house icon
  const markerElement = document.createElement('div');
  markerElement.className = 'property-marker';
  markerElement.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 2px solid #059669;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
  `;

  // House icon
  markerElement.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#059669" stroke="#059669" stroke-width="1">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9,22 9,12 15,12 15,22"></polyline>
    </svg>
  `;

  // Create the advanced marker
  const marker = new AdvancedMarkerElement({
    map,
    position,
    title,
    content: markerElement,
  });

  return marker;
};

export const calculateRoute = async (
  origin: string,
  destination: string
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
