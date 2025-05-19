'use client';

import { useState, useEffect } from 'react';
import { getNextComparisonPair, recordComparisonAndUpdateRankings, resetUserComparisonsAndRankings, getUserPairwiseRelations } from '@/lib/utils';
import { Property } from '@/lib/types';
import toast, { Toaster } from 'react-hot-toast';
import { ExternalLink, Trophy, CheckCircle, ArrowRight, RefreshCw, Bed, Bath, Home, PoundSterling, MapPin, Calendar, Info } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function Compare() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [completedComparisons, setCompletedComparisons] = useState(0);
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pairwiseMatrix, setPairwiseMatrix] = useState<{ matrix: { [a: string]: { [b: string]: string } }, propertyIds: string[], idToPropertyId: { [docId: string]: string } }>({ matrix: {}, propertyIds: [], idToPropertyId: {} });
  const [activeImage, setActiveImage] = useState<{[key: string]: number}>({});

  // Redirect if not authenticated
  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      if (!authLoading && !user) {
        if (mounted) {
          router.push('/login');
        }
      }
    };
    
    checkAuth();
    
    return () => {
      mounted = false;
    };
  }, [user, authLoading, router]);

  // Add auth loading timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (authLoading) {
        setError('Authentication is taking longer than expected. Please try refreshing the page.');
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [authLoading]);

  const loadNextComparison = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const pair = await getNextComparisonPair(user.uid);
      
      if (!pair) {
        // All comparisons are done
        toast.success('🎉 All comparisons complete! Check your rankings.', {
          duration: 5000
        });
        setProperties([]);
      } else {
        setProperties(pair);
      }
    } catch (error) {
      console.error('Error loading property pair:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load properties';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  

  // Helper to fetch and update the pairwise matrix
  const updatePairwiseMatrix = async () => {
    if (!user) return;
    
    try {
      if (process.env.NODE_ENV !== 'production') {
        const matrix = await getUserPairwiseRelations(user.uid);
        setPairwiseMatrix(matrix);
      }
    } catch (error) {
      console.error('Error updating pairwise matrix:', error);
      // Don't show error to user for debug feature
    }
  };

  // Helper to calculate total comparisons
  const calculateTotalComparisons = async () => {
    try {
      // For binary insertion sort, we need approximately n*log(n) comparisons
      const response = await fetch('/api/properties/count');
      if (response.ok) {
        const { count } = await response.json();
        setTotalComparisons(Math.ceil(count * Math.log2(count)));
      } else {
        throw new Error('Failed to get property count');
      }
    } catch (error) {
      console.error('Error calculating total comparisons:', error);
      // Don't show error to user for this non-critical feature
    }
  };

  useEffect(() => {
    if (user) {
      loadNextComparison();
      calculateTotalComparisons();
      updatePairwiseMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChoice = async (winnerId: string, loserId: string) => {
    if (!user) return;
    
    try {
      setIsComparing(true);
      setError(null);
      await recordComparisonAndUpdateRankings(user.uid, winnerId, loserId);
      setCompletedComparisons(prev => prev + 1);
      toast.success('Comparison recorded! Loading next comparison...');
      await loadNextComparison();
      await updatePairwiseMatrix();
      // Reset active images for new properties
      setActiveImage({});
    } catch (error) {
      console.error('Error recording comparison:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to record comparison';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsComparing(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      await resetUserComparisonsAndRankings(user.uid);
      setCompletedComparisons(0);
      toast.success('All comparisons and rankings have been reset!');
      await loadNextComparison();
      await updatePairwiseMatrix();
    } catch (error) {
      console.error('Error resetting comparisons:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset comparisons';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // If still loading auth or not authenticated, show loading
  if (authLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading authentication...</p>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            loadNextComparison();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Render the debug table outside of the main conditional, so it shows on all screens
  const debugTable = process.env.NODE_ENV !== 'production' && pairwiseMatrix.propertyIds.length > 0 && (
    <div className="mt-8 p-4 bg-gray-100 rounded text-xs overflow-auto">
      <h3 className="font-bold mb-2 text-gray-900">Debug: Pairwise Relations</h3>
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1 bg-gray-200"></th>
            {pairwiseMatrix.propertyIds.map(id => (
              <th key={id} className="border px-2 py-1 bg-gray-200 text-gray-900">{pairwiseMatrix.idToPropertyId[id]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pairwiseMatrix.propertyIds.map(rowId => (
            <tr key={rowId}>
              <th className="border px-2 py-1 bg-gray-200 text-gray-900">{pairwiseMatrix.idToPropertyId[rowId]}</th>
              {pairwiseMatrix.propertyIds.map(colId => {
                const rel = pairwiseMatrix.matrix[rowId][colId];
                let color = 'text-gray-800';
                if (rel === 'direct') color = 'bg-green-200 text-green-900';
                else if (rel === 'inferred') color = 'bg-blue-100 text-blue-900';
                else if (rel === 'unknown') color = 'bg-red-100 text-red-900';
                return (
                  <td key={colId} className={`border px-2 py-1 text-center font-mono ${color}`}>{rel}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto mb-4 text-yellow-500" size={64} />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">All Done!</h2>
        <p className="text-gray-600 mb-6">
          You've completed all necessary comparisons.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Completed {completedComparisons} comparisons in this session.
        </p>
        <div className="space-y-4">
          <a 
            href="/rankings" 
            className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
          >
            View Rankings <ArrowRight className="ml-2" size={16} />
          </a>
          <button
            onClick={handleReset}
            className="block mx-auto mt-4 inline-flex items-center text-gray-600 hover:text-gray-800"
          >
            <RefreshCw className="mr-2" size={16} />
            Reset All Comparisons
          </button>
        </div>
        {debugTable}
      </div>
    );
  }

  const progress = totalComparisons > 0 ? Math.min(100, (completedComparisons / totalComparisons) * 100) : 0;

  // Helper function to change active image
  const changeActiveImage = (propertyId: string, index: number) => {
    setActiveImage(prev => ({
      ...prev,
      [propertyId]: index
    }));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Toaster position="top-center" />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Compare Properties</h1>
          <p className="text-gray-600">
            Choose which property you prefer
          </p>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className="mr-2" size={16} />
          Reset
        </button>
      </div>
      
      {progress > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-8">
        {properties.map((property) => {
          const currentImageIndex = activeImage[property.id] || 0;
          
          return (
            <div key={property.id} className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-xl font-bold text-center text-gray-900">
                  {property.address || property.postcode || `${property.site}: ${property.propertyId}`}
                </h3>
              </div>
              
              {/* Image Gallery */}
              <div className="relative h-64 bg-gray-200">
                {property.images && property.images.length > 0 ? (
                  <>
                    <img 
                      src={property.images[currentImageIndex]} 
                      alt={`Property image`} 
                      className="w-full h-full object-cover"
                    />
                    {property.images.length > 1 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-center">
                        {property.images.map((_, index) => (
                          <button 
                            key={index}
                            onClick={() => changeActiveImage(property.id, index)}
                            className={`w-3 h-3 rounded-full mx-1 ${index === currentImageIndex ? 'bg-white' : 'bg-gray-400'}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Home size={48} className="text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Property Details */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center">
                    <PoundSterling className="text-blue-600 mr-2" size={18} />
                    <div>
                      <p className="text-xs text-gray-600">Price</p>
                      <p className="font-semibold">
                        {property.price ? `£${property.price} ${property.priceFrequency || 'pcm'}` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <MapPin className="text-blue-600 mr-2" size={18} />
                    <div>
                      <p className="text-xs text-gray-600">Location</p>
                      <p className="font-semibold">{property.postcode || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <Bed className="text-blue-600 mr-2" size={18} />
                    <div>
                      <p className="text-xs text-gray-600">Bedrooms</p>
                      <p className="font-semibold">{property.bedrooms || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <Bath className="text-blue-600 mr-2" size={18} />
                    <div>
                      <p className="text-xs text-gray-600">Bathrooms</p>
                      <p className="font-semibold">{property.bathrooms || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <Home className="text-blue-600 mr-2" size={18} />
                    <div>
                      <p className="text-xs text-gray-600">Property Type</p>
                      <p className="font-semibold">{property.propertyType || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <Calendar className="text-blue-600 mr-2" size={18} />
                    <div>
                      <p className="text-xs text-gray-600">Available From</p>
                      <p className="font-semibold">{property.availableFrom || 'Not specified'}</p>
                    </div>
                  </div>
                </div>
                
                {/* Description Preview */}
                {property.description && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-1">Description</p>
                    <p className="text-sm text-gray-800 line-clamp-3">{property.description}</p>
                  </div>
                )}
                
                {/* Features */}
                {property.features && property.features.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-1">Key Features</p>
                    <ul className="text-sm text-gray-800 pl-5 list-disc">
                      {property.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="line-clamp-1">{feature}</li>
                      ))}
                      {property.features.length > 3 && (
                        <li className="text-blue-600">+{property.features.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <a 
                    href={property.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on {property.site} <ExternalLink className="ml-1" size={14} />
                  </a>
                  
                  <button
                    onClick={() => handleChoice(property.id, properties.find(p => p.id !== property.id)!.id)}
                    disabled={isComparing}
                    className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Choose This Property
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="text-center mt-8">
        <p className="text-sm text-gray-600">
          This comparison will help determine your property rankings
        </p>
      </div>

      {debugTable}
    </div>
  );
}