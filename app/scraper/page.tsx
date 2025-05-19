'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Property } from '@/lib/types';
import { useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import JsonExplorer from './json-explorer';

export default function PropertyScraper() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    skipped: number;
    messages: string[];
  }>({ success: 0, failed: 0, skipped: 0, messages: [] });

  const scrapeProperty = async (property: Property) => {
    try {
      // Call our enhanced scraper API
      const response = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: property.url, 
          site: property.site,
          propertyId: property.propertyId 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to scrape: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Update the property with scraped data
      await updateDoc(doc(db, 'properties', property.id), {
        ...data,
        lastScraped: Date.now(),
      });

      return { success: true, message: `Successfully scraped ${property.site}: ${property.propertyId}` };
    } catch (error) {
      console.error(`Error scraping ${property.url}:`, error);
      return { 
        success: false, 
        message: `Failed to scrape ${property.site}: ${property.propertyId} - ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  };

  const handleScrapeAll = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setResults({ success: 0, failed: 0, skipped: 0, messages: [] });
    
    try {
      // Get all properties
      const propertiesSnapshot = await getDocs(collection(db, 'properties'));
      const properties = propertiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Property));
      
      const results = { success: 0, failed: 0, skipped: 0, messages: [] as string[] };
      
      // Process properties sequentially to avoid rate limiting
      for (const property of properties) {
        // Skip properties without a URL or site
        if (!property.url || !property.site) {
          results.skipped++;
          results.messages.push(`Skipped ${property.id}: Missing URL or site information`);
          setResults({ ...results });
          continue;
        }
        
        const result = await scrapeProperty(property);
        
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
        }
        
        results.messages.push(result.message);
        
        // Update results as we go
        setResults({ ...results });
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error in scrape operation:', error);
      setResults(prev => ({
        ...prev,
        messages: [...prev.messages, `General error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold text-white-900 mb-6">Property Scraper</h1>
        
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <p className="text-gray-700 mb-4">
            This tool will scrape updated information for all properties in the database.
            The process may take several minutes depending on the number of properties.
          </p>
          
          <button
            onClick={handleScrapeAll}
            disabled={isLoading}
            className={`flex items-center px-4 py-2 rounded-lg font-medium ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw size={20} className="mr-2 animate-spin" />
                Scraping Properties...
              </>
            ) : (
              <>
                <RefreshCw size={20} className="mr-2" />
                Scrape All Properties
              </>
            )}
          </button>
        </div>
        
        {/* Add the JSON Explorer component */}
        <JsonExplorer />
        
        {results.messages.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Scraping Results</h2>
              <div className="flex space-x-4">
                <div className="flex items-center">
                  <Check size={18} className="text-green-500 mr-1" />
                  <span className="text-sm font-medium">{results.success} Successful</span>
                </div>
                <div className="flex items-center">
                  <AlertCircle size={18} className="text-red-500 mr-1" />
                  <span className="text-sm font-medium">{results.failed} Failed</span>
                </div>
                {results.skipped > 0 && (
                  <div className="flex items-center">
                    <AlertCircle size={18} className="text-yellow-500 mr-1" />
                    <span className="text-sm font-medium">{results.skipped} Skipped</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              <ul className="space-y-2">
                {results.messages.map((message, index) => (
                  <li 
                    key={index} 
                    className={`p-2 rounded ${
                      message.includes('Successfully') 
                        ? 'bg-green-50 text-green-800' 
                        : message.includes('Skipped')
                          ? 'bg-yellow-50 text-yellow-800'
                          : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}