'use client';

import { useState, useEffect } from 'react';
import { getGlobalRankings } from '@/lib/utils';
import { Property } from '@/lib/types';
import { Trophy, Users, UserCheck, UserX, Bed, Bath, Home, PoundSterling, MapPin } from 'lucide-react';
import Link from 'next/link';

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-extrabold mb-6 text-center text-white-900">
        Global Property Rankings
      </h1>
      <p className="text-center text-gray-600 mb-8 font-medium">
        Aggregate rankings based on all user comparisons
      </p>
      
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="divide-y divide-gray-100">
          {rankings.map((item) => {
            const status = getRankingStatus(item.rankCount, item.totalUsers);
            return (
              <Link href={`/property/${item.property.id}`} key={item.property.id} className="block py-6 first:pt-0 last:pb-0">
                <div className="bg-gray-50 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer relative flex">
                  <div className="flex-grow flex">
                    <div className="w-48 h-32 flex-shrink-0 relative">
                      {item.property.images && item.property.images.length > 0 ? (
                        <img 
                          src={item.property.images[0]} 
                          alt={item.property.address || item.property.postcode || 'Property'} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-gray-100">
                          <Home size={32} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl font-bold text-blue-600">
                              #{item.rank}
                            </span>
                            {item.rank <= 3 && (
                              <Trophy 
                                className={
                                  item.rank === 1 ? "text-yellow-500" : 
                                  item.rank === 2 ? "text-gray-400" : 
                                  "text-yellow-700"
                                } 
                                size={24} 
                              />
                            )}
                            <h3 className="font-medium text-gray-900 text-lg">
                              {item.property.address || item.property.postcode || `${item.property.site}: ${item.property.propertyId}`}
                            </h3>
                          </div>
                          <div className="flex items-center space-x-4">
                            {item.property.price && (
                              <div className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                                <PoundSterling size={16} className="mr-1" />
                                <span>{item.property.price} {item.property.priceFrequency || 'pcm'}</span>
                              </div>
                            )}
                            <div className="relative">
                              <div className="cursor-help">
                                {getRankingStatusIcon(status)}
                              </div>
                              <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 pointer-events-none z-50 transition-opacity duration-200 [.cursor-help:hover_&]:opacity-100">
                                {status === 'all' && 'Ranked by all users'}
                                {status === 'some' && 'Ranked by some users'}
                                {status === 'none' && 'Not ranked by any users'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center text-gray-600 text-sm mb-2">
                          <MapPin size={14} className="mr-1" />
                          <span>{item.property.postcode || 'Location not specified'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-700">
                        {item.property.bedrooms && (
                          <div className="flex items-center">
                            <Bed size={16} className="mr-1" />
                            <span>{item.property.bedrooms} beds</span>
                          </div>
                        )}
                        {item.property.bathrooms && (
                          <div className="flex items-center">
                            <Bath size={16} className="mr-1" />
                            <span>{item.property.bathrooms} baths</span>
                          </div>
                        )}
                        {item.property.propertyType && (
                          <div className="flex items-center">
                            <Home size={16} className="mr-1" />
                            <span>{item.property.propertyType}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Added by {item.property.addedBy}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      
      <div className="mt-8 text-center text-sm text-gray-600 font-medium">
        <p>Rankings are based on aggregate user comparisons</p>
        <p>Hover over the status icon to see ranking details</p>
      </div>
    </div>
  );
}