'use client';

import { useState } from 'react';
import { Search, Code, Copy, Check } from 'lucide-react';

export default function JsonExplorer() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const handleExplore = async () => {
    if (!url) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, mode: 'explore' }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to explore: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResult(data);
      
      // Select the first key by default if available
      const keys = Object.keys(data.extractedData || {});
      if (keys.length > 0) {
        setSelectedKey(keys[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">JSON Explorer</h2>
      <p className="text-gray-700 mb-4">
        Enter a property URL to explore the JSON data available on the page. This helps identify the structure
        for building scrapers for different property websites.
      </p>
      
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter property URL (e.g., https://www.rightmove.co.uk/properties/123456789)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleExplore}
          disabled={isLoading || !url}
          className={`flex items-center px-4 py-2 rounded-lg font-medium ${
            isLoading || !url
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? (
            <>
              <Search size={20} className="mr-2 animate-spin" />
              Exploring...
            </>
          ) : (
            <>
              <Search size={20} className="mr-2" />
              Explore
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-6">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="mt-6">
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <p><strong>URL:</strong> {result.url}</p>
            <p><strong>Detected Site:</strong> {result.detectedSite}</p>
            <p><strong>Found JSON Objects:</strong> {Object.keys(result.extractedData || {}).length}</p>
          </div>
          
          {Object.keys(result.extractedData || {}).length > 0 && (
            <div className="mt-4">
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {Object.keys(result.extractedData).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap ${
                      selectedKey === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
              
              {selectedKey && (
                <div className="relative">
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(result.extractedData[selectedKey], null, 2))}
                      className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-auto max-h-[500px]">
                    <code>{JSON.stringify(result.extractedData[selectedKey], null, 2)}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}