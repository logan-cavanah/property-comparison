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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rankings.map((item) => {
          const status = getRankingStatus(item.rankCount, item.totalUsers);
          return (
            <Link href={`/property/${item.property.id}`} key={item.property.id}>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer h-full relative">
                <div className="absolute top-0 left-0 bg-blue-600 text-white w-10 h-10 flex items-center justify-center font-bold z-10 text-lg">
                  {item.rank}
                </div>
                {item.rank <= 3 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Trophy 
                      className={
                        item.rank === 1 ? "text-yellow-500" : 
                        item.rank === 2 ? "text-gray-400" : 
                        "text-yellow-700"
                      } 
                      size={28} 
                    />
                  </div>
                )}
                <div className="absolute top-2 right-12 z-10 group">
                  {getRankingStatusIcon(status)}
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    {status === 'all' && 'Ranked by all users'}
                    {status === 'some' && 'Ranked by some users'}
                    {status === 'none' && 'Not ranked by any users'}
                  </div>
                </div>
                <div className="h-48 bg-gray-200 relative">
                  {item.property.images && item.property.images.length > 0 ? (
                    <img 
                      src={item.property.images[0]} 
                      alt={item.property.address || item.property.postcode || 'Property'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Home size={48} className="text-gray-400" />
                    </div>
                  )}
                  {item.property.price && (
                    <div className="absolute bottom-0 left-0 bg-blue-600 text-white px-3 py-1 flex items-center">
                      <PoundSterling size={16} className="mr-1" />
                      <span>{item.property.price} {item.property.priceFrequency || 'pcm'}</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 mb-2 truncate">
                    {item.property.address || item.property.postcode || `${item.property.site}: ${item.property.propertyId}`}
                  </h3>
                  <div className="flex items-center text-gray-600 text-sm mb-3">
                    <MapPin size={14} className="mr-1" />
                    <span>{item.property.postcode || 'Location not specified'}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-700">
                    {item.property.bedrooms && (
                      <div className="flex items-center">
                        <Bed size={14} className="mr-1" />
                        <span>{item.property.bedrooms}</span>
                      </div>
                    )}
                    {item.property.bathrooms && (
                      <div className="flex items-center">
                        <Bath size={14} className="mr-1" />
                        <span>{item.property.bathrooms}</span>
                      </div>
                    )}
                    {item.property.propertyType && (
                      <div className="flex items-center">
                        <Home size={14} className="mr-1" />
                        <span>{item.property.propertyType}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Added by {item.property.addedBy}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="mt-8 text-center text-sm text-gray-600 font-medium">
        <p>Rankings are based on aggregate user comparisons</p>
        <p>Hover over the status icon to see ranking details</p>
      </div>
    </div>
  );
}