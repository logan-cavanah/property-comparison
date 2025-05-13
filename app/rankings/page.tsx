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
        <p className="mt-4 text-gray-700 font-medium">Loading rankings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold mb-6 text-center text-white-900">
        Global Property Rankings
      </h1>
      <p className="text-center text-gray-600 mb-8 font-medium">
        Aggregate rankings based on all user comparisons (lower scores are better)
      </p>
      
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Property
              </th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-700 uppercase tracking-wider text-right">
                Total Score
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rankings.map((item) => (
              <tr key={item.property.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {item.rank === 1 && <Trophy className="text-yellow-500 mr-2" size={20} />}
                    {item.rank === 2 && <Trophy className="text-gray-400 mr-2" size={20} />}
                    {item.rank === 3 && <Trophy className="text-yellow-700 mr-2" size={20} />}
                    <span className="text-sm font-semibold text-gray-900">{item.rank}</span>
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                  {item.score === Number.MAX_VALUE ? 'Unranked' : item.score}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <a
                    href={item.property.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink size={16} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 text-center text-sm text-gray-600 font-medium">
        <p>Scores are the sum of individual user rankings</p>
        <p>Unranked properties have not been compared by any user</p>
      </div>
    </div>
  );
}