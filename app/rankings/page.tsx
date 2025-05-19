'use client';

import { useState, useEffect } from 'react';
import { getGlobalRankings } from '@/lib/utils';
import { Property } from '@/lib/types';
import { ExternalLink, Trophy, Users, UserCheck, UserX } from 'lucide-react';

export default function Rankings() {
  const [rankings, setRankings] = useState<{ property: Property; rank: number; score: number; rankCount: number; totalUsers: number }[]>([]);
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

  const getRankingStatus = (rankCount: number, totalUsers: number) => {
    if (totalUsers === 0) return 'none'; // Should ideally not happen if there are properties
    if (rankCount === 0) return 'none';
    if (rankCount === totalUsers) return 'all';
    return 'some';
  };

  const getRankingStatusIcon = (status: string) => {
    switch (status) {
      case 'all':
        return <UserCheck className="text-green-500" size={20} />;
      case 'some':
        return <Users className="text-yellow-500" size={20} />;
      case 'none':
        return <UserX className="text-gray-400" size={20} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold mb-6 text-center text-white-900">
        Global Property Rankings
      </h1>
      <p className="text-center text-gray-600 mb-8 font-medium">
        Aggregate rankings based on all user comparisons
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
                Ranking Status
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rankings.map((item) => {
              const status = getRankingStatus(item.rankCount, item.totalUsers);
              return (
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
                    <Link href={`/property/${item.property.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                      {item.property.site}: {item.property.propertyId}
                    </Link>
                    <div className="text-sm text-gray-500">
                      Added by {item.property.addedBy}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end items-center">
                      <div className="group relative">
                        {getRankingStatusIcon(status)}
                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          {status === 'all' && 'Ranked by all users'}
                          {status === 'some' && 'Ranked by some users'}
                          {status === 'none' && 'Not ranked by any users'}
                        </div>
                      </div>
                    </div>
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
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 text-center text-sm text-gray-600 font-medium">
        <p>Rankings are based on aggregate user comparisons</p>
        <p>Hover over the status icon to see ranking details</p>
      </div>
    </div>
  );
}