'use client';

import { useState, useEffect } from 'react';
import { getGlobalRankings } from '@/lib/utils';
import { Property } from '@/lib/types';
import { ExternalLink, Trophy } from 'lucide-react';

export default function Rankings() {
  const [rankings, setRankings] = useState<{ property: Property; rank: number; score: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRankings = async () => {
      try {
        const results = await getGlobalRankings();
        setRankings(results);
      } catch (error) {
        console.error('Error loading rankings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRankings();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading rankings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Property Rankings</h1>
      <p className="text-center text-gray-600 mb-8">
        Rankings based on all user comparisons
      </p>
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rankings.map((item) => (
              <tr key={item.property.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {item.rank === 1 && <Trophy className="text-yellow-500 mr-2" size={20} />}
                    {item.rank === 2 && <Trophy className="text-gray-400 mr-2" size={20} />}
                    {item.rank === 3 && <Trophy className="text-yellow-700 mr-2" size={20} />}
                    <span className="text-sm font-medium text-gray-900">{item.rank}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {item.property.site}: {item.property.propertyId}
                  </div>
                  <div className="text-sm text-gray-500">
                    Added by {item.property.addedBy}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {item.score === Number.MAX_VALUE ? 'Not ranked' : item.score.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a
                    href={item.property.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <ExternalLink size={16} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 text-center text-sm text-gray-600">
        <p>Rankings are calculated by averaging the individual rankings from all users</p>
        <p>Lower scores are better (closer to rank 1)</p>
      </div>
    </div>
  );
}