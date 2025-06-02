import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { origin, destination } = await request.json();

    if (!origin) {
      return NextResponse.json(
        { error: 'Origin is required' },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        { error: 'Destination is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_API_KEY!,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.steps'
        },
        body: JSON.stringify({
          origin: {
            address: origin
          },
          destination: {
            address: destination
          },
          travelMode: 'TRANSIT',
          transitPreferences: {
            allowedTravelModes: ['BUS', 'SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'],
            routingPreference: 'LESS_WALKING'
          },
          languageCode: 'en-US',
          units: 'METRIC'
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to calculate route');
    }

    // Extract route information
    const route = data.routes[0];
    const leg = route.legs[0];
    
    // Parse duration string (e.g., "2322s" to seconds)
    const parseDuration = (durationStr: string) => {
      const seconds = parseInt(durationStr.replace('s', ''));
      return isNaN(seconds) ? 0 : seconds;
    };

    // Format duration from seconds to human-readable format
    const formatDuration = (seconds: number) => {
      if (!seconds || isNaN(seconds)) return 'Unknown duration';
      
      const minutes = Math.round(seconds / 60);
      if (minutes < 60) return `${minutes} mins`;
      
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    };

    const totalDuration = parseDuration(route.duration);
    const durationText = formatDuration(totalDuration);

    // Convert distance from meters to kilometers
    const distanceInKm = (route.distanceMeters / 1000).toFixed(1);
    const distanceText = `${distanceInKm} km`;

    return NextResponse.json({
      duration: durationText,
      distance: distanceText,
      steps: leg.steps.map((step: any) => ({
        instruction: step.navigationInstruction?.instructions || 'Continue',
        duration: formatDuration(parseDuration(step.staticDuration)),
        distance: `${(step.distanceMeters / 1000).toFixed(1)} km`,
        mode: step.travelMode
      }))
    });
  } catch (error) {
    console.error('Error calculating route:', error);
    return NextResponse.json(
      { error: 'Failed to calculate route' },
      { status: 500 }
    );
  }
} 