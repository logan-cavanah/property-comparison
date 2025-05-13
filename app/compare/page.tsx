'use client';

import { useState, useEffect } from 'react';
import { getNextComparisonPair, recordComparisonAndUpdateRankings, resetUserComparisonsAndRankings, getUserPairwiseRelations } from '@/lib/utils';
import { Property } from '@/lib/types';
import toast, { Toaster } from 'react-hot-toast';
import { ExternalLink, Trophy, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
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
  const [pairwiseMatrix, setPairwiseMatrix] = useState<{ matrix: { [a: string]: { [b: string]: string } }, propertyIds: string[], idToPropertyId: { [docId: string]: string } }>({ matrix: {}, propertyIds: [], idToPropertyId: {} });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadNextComparison = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
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
      toast.error('Failed to load properties');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to fetch and update the pairwise matrix
  const updatePairwiseMatrix = async () => {
    if (!user) return;
    
    if (process.env.NODE_ENV !== 'production') {
      const matrix = await getUserPairwiseRelations(user.uid);
      setPairwiseMatrix(matrix);
    }
  };

  // Helper to calculate total comparisons
  const calculateTotalComparisons = async () => {
    // For binary insertion sort, we need approximately n*log(n) comparisons
    // This is a rough estimate
    const response = await fetch('/api/properties/count');
    if (response.ok) {
      const { count } = await response.json();
      setTotalComparisons(Math.ceil(count * Math.log2(count)));
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
      await recordComparisonAndUpdateRankings(user.uid, winnerId, loserId);
      setCompletedComparisons(prev => prev + 1);
      toast.success('Comparison recorded! Loading next comparison...');
      await loadNextComparison();
      await updatePairwiseMatrix();
    } catch (error) {
      console.error('Error recording comparison:', error);
      toast.error('Failed to record comparison');
    } finally {
      setIsComparing(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      await resetUserComparisonsAndRankings(user.uid);
      setCompletedComparisons(0);
      toast.success('All comparisons and rankings have been reset!');
      await loadNextComparison();
      await updatePairwiseMatrix();
    } catch (error) {
      console.error('Error resetting comparisons:', error);
      toast.error('Failed to reset comparisons');
    } finally {
      setIsLoading(false);
    }
  };

  // If still loading auth or not authenticated, show loading
  if (authLoading || !user) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
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

  return (
    <div className="max-w-4xl mx-auto">
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
      
      <div className="grid md:grid-cols-2 gap-6">
        {properties.map((property) => (
          <div key={property.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 text-center text-gray-900">
                {property.site}: <span className="font-bold text-black">{property.propertyId}</span>
              </h3>
              
              <div className="text-center mb-6">
                <a 
                  href={property.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  View Property <ExternalLink className="ml-2" size={16} />
                </a>
              </div>
              
              <button
                onClick={() => handleChoice(property.id, properties.find(p => p.id !== property.id)!.id)}
                disabled={isComparing}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isComparing ? 'Processing...' : 'Choose This Property'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-8">
        <p className="text-sm text-gray-600">
          This comparison will help determine your property rankings
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Using binary insertion sort for efficient ranking
        </p>
      </div>

      {debugTable}
    </div>
  );
}