'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property } from '@/lib/types';
import { ExternalLink, Calendar, Home, Bed, Bath, MapPin, PoundSterling, Info, Image, Trash2 } from 'lucide-react';
import Link from 'next/link';
import PropertyMap from '../../components/PropertyMap';
import DOMPurify from 'dompurify';
export default function PropertyDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const sanitizeHtml = (html: string) => {
    return { __html: DOMPurify.sanitize(html) };
  };  

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        // First, we need to find which group this property belongs to
        // We'll use a utility function to help with this
        const [groupId, propertyDoc] = await findPropertyDocument(id as string);
        
        if (propertyDoc && propertyDoc.exists()) {
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
  
  // Helper function to find a property document across all groups
  const findPropertyDocument = async (propertyId: string): Promise<[string | null, any]> => {
    try {
      // Get all groups - in a real app this might be optimized to only search relevant groups
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      
      for (const groupDoc of groupsSnapshot.docs) {
        const groupId = groupDoc.id;
        const propertyDoc = await getDoc(doc(db, `groups/${groupId}/properties`, propertyId));
        
        if (propertyDoc.exists()) {
          return [groupId, propertyDoc];
        }
      }
      
      // If we reach here, the property wasn't found in any group
      return [null, null];
    } catch (error) {
      console.error('Error finding property:', error);
      return [null, null];
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      // Find which group the property belongs to first
      const [groupId, _] = await findPropertyDocument(id as string);
      
      if (!groupId) {
        throw new Error('Property not found in any group');
      }
      
      // Delete the property from the group's subcollection
      await deleteDoc(doc(db, `groups/${groupId}/properties`, id as string));
      router.push('/');
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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
      <div className="mb-6 flex justify-between items-center">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} className="mr-2" />
          {isDeleting ? 'Deleting...' : 'Delete Property'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Property Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {property.title || `${property.site}: ${property.propertyId}`}
              </h1>
              <p className="text-gray-800 mt-1">{property.address || property.postcode || 'Address not available'}</p>
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
            <h2 className="text-xl font-bold mb-4 flex items-center text-gray-900">
              <Info className="mr-2 text-gray-900" size={20} /> Property Details
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center">
                <PoundSterling className="text-gray-700 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-700">Price</p>
                  <p className="font-semibold text-gray-900">
                    {property.price ? `£${property.price} ${property.priceFrequency || 'pcm'}` : 'Not specified'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Home className="text-gray-700 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-700">Property Type</p>
                  <p className="font-semibold text-gray-900">{property.propertyType || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Bed className="text-gray-700 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-700">Bedrooms</p>
                  <p className="font-semibold text-gray-900">{property.bedrooms || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Bath className="text-gray-700 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-700">Bathrooms</p>
                  <p className="font-semibold text-gray-900">{property.bathrooms || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <MapPin className="text-gray-700 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-700">Postcode</p>
                  <p className="font-semibold text-gray-900">{property.postcode || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <Calendar className="text-gray-700 mr-2" size={20} />
                <div>
                  <p className="text-sm text-gray-700">Available From</p>
                  <p className="font-semibold text-gray-900">{property.availableFrom || 'Not specified'}</p>
                </div>
              </div>
            </div>

            {/* Map Section */}
            {property.postcode && (
              <div className="mb-6">
                <h3 className="font-bold mb-2 text-gray-900">Location</h3>
                <PropertyMap postcode={property.postcode} address={property.address} />
              </div>
            )}
            
            <h3 className="font-bold mb-2 text-gray-900">Description</h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              {property.description ? (
                <div 
                  className="text-gray-800 whitespace-pre-line"
                  dangerouslySetInnerHTML={sanitizeHtml(property.description)}
                />
              ) : (
                <p className="text-gray-600 italic">No description available</p>
              )}
            </div>
            
            {property.features && property.features.length > 0 && (
              <>
                <h3 className="font-bold mb-2 text-gray-900">Features</h3>
                <ul className="list-disc list-inside bg-gray-50 p-4 rounded-lg mb-6">
                  {property.features.map((feature, index) => (
                    <li key={index} className="text-gray-800">{feature}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          
          <div>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Agent Information</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-900">{property.agentName || 'Agent information not available'}</p>
              {property.agentPhone && (
                <p className="text-gray-800 mt-2">
                  <span className="font-medium">Phone:</span> {property.agentPhone}
                </p>
              )}
              {property.agentEmail && (
                <p className="text-gray-800 mt-2">
                  <span className="font-medium">Email:</span> {property.agentEmail}
                </p>
              )}
            </div>
            
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Property Added By</h2>
              <p className="text-gray-800">{property.addedBy}</p>
              <p className="text-gray-700 text-sm">
                Added on {new Date(property.addedAt).toLocaleDateString()}
              </p>
              {property.lastScraped && (
                <p className="text-gray-700 text-sm">
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