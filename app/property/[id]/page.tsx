'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/lib/types';
import { ExternalLink, Calendar, Home, Bed, Bath, MapPin, PoundSterling, Info, Image } from 'lucide-react';
import Link from 'next/link';

export default function PropertyDetails() {
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const propertyDoc = await getDoc(doc(db, 'properties', id as string));
        if (propertyDoc.exists()) {
          setProperty({ id: propertyDoc.id, ...propertyDoc.data() } as Property);
        }
      } catch (error) {
        console.error('Error fetching property:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProperty();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-700 font-medium">Loading property details...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Property not found!</strong>
          <span className="block sm:inline"> The property you're looking for doesn't exist or has been removed.</span>
        </div>
        <Link href="/" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Property Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {property.title || `${property.site}: ${property.propertyId}`}
              </h1>
              <p className="text-gray-600 mt-1">{property.address || property.postcode || 'Address not available'}</p>
            </div>
            <a
              href={property.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
            >
              <ExternalLink size={16} className="mr-2" /> View on {property.site}
            </a>
          </div>
        </div>

        {/* Image Gallery */}
        {property.images && property.images.length > 0 ? (
          <div className="relative">
            <div className="h-96 overflow-hidden">
              <img 
                src={property.images[activeImage]} 
                alt={`Property image ${activeImage + 1}`} 
                className="w-full h-full object-cover"
              />
            </div>
            {property.images.length > 1 && (
              <div className="p-2 flex overflow-x-auto">
                {property.images.map((image, index) => (
                  <div 
                    key={index} 
                    className={`w-24 h-24 flex-shrink-0 cursor-pointer m-1 border-2 ${index === activeImage ? 'border-blue-600' : 'border-transparent'}`}
                    onClick={() => setActiveImage(index)}
                  >
                    <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-48 bg-gray-200 flex items-center justify-center">
            <Image size={48} className="text-gray-400" />
            <p className="text-gray-500 ml-2">No images available</p>
          </div>
        )}

        {/* Property Details */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <Info className="mr-2" size={20} /> Property Details
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center">
                <PoundSterling className="text-gray-500 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Price</p>
                  <p className="font-semibold">
                    {property.price ? `£${property.price} ${property.priceFrequency || 'pcm'}` : 'Not specified'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Home className="text-gray-500 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Property Type</p>
                  <p className="font-semibold">{property.propertyType || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Bed className="text-gray-500 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Bedrooms</p>
                  <p className="font-semibold">{property.bedrooms || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Bath className="text-gray-500 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Bathrooms</p>
                  <p className="font-semibold">{property.bathrooms || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <MapPin className="text-gray-500 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Postcode</p>
                  <p className="font-semibold">{property.postcode || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Calendar className="text-gray-500 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Available From</p>
                  <p className="font-semibold">{property.availableFrom || 'Not specified'}</p>
                </div>
              </div>
            </div>
            
            <h3 className="font-bold mb-2">Description</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              {property.description ? (
                <p className="text-gray-700 whitespace-pre-line">{property.description}</p>
              ) : (
                <p className="text-gray-500 italic">No description available</p>
              )}
            </div>
            
            {property.features && property.features.length > 0 && (
              <>
                <h3 className="font-bold mb-2">Features</h3>
                <ul className="list-disc list-inside bg-gray-50 p-4 rounded-lg mb-6">
                  {property.features.map((feature, index) => (
                    <li key={index} className="text-gray-700">{feature}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          
          <div>
            <h2 className="text-xl font-bold mb-4">Agent Information</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold">{property.agentName || 'Agent information not available'}</p>
              {property.agentPhone && (
                <p className="text-gray-700 mt-2">
                  <span className="font-medium">Phone:</span> {property.agentPhone}
                </p>
              )}
              {property.agentEmail && (
                <p className="text-gray-700 mt-2">
                  <span className="font-medium">Email:</span> {property.agentEmail}
                </p>
              )}
            </div>
            
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-4">Property Added By</h2>
              <p className="text-gray-700">{property.addedBy}</p>
              <p className="text-gray-500 text-sm">
                Added on {new Date(property.addedAt).toLocaleDateString()}
              </p>
              {property.lastScraped && (
                <p className="text-gray-500 text-sm">
                  Last scraped on {new Date(property.lastScraped).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}