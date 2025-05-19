'use client';

import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

interface ExplorerResponse {
  url: string;
  detectedSite: string;
  extractedData: Record<string, any>;
}

interface JsonViewerProps {
  data: any;
  name: string;
  level?: number;
}

const JsonViewer = ({ data, name, level = 0 }: JsonViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data !== 'object') {
    return (
      <div className="ml-4">
        <span className="text-gray-600">{name}: </span>
        <span className="text-gray-900">{String(data)}</span>
      </div>
    );
  }

  const isArray = Array.isArray(data);
  const items = isArray ? data : Object.entries(data);
  const isEmpty = items.length === 0;

  return (
    <div className={`ml-${level * 4}`}>
      <div 
        className="flex items-center cursor-pointer hover:bg-gray-50 py-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-500 mr-1" />
        ) : (
          <ChevronRight size={16} className="text-gray-500 mr-1" />
        )}
        <span className="font-medium text-gray-900">{name}</span>
        <span className="text-gray-500 ml-2">
          {isArray ? `[${items.length}]` : `{${items.length}}`}
        </span>
      </div>
      
      {isExpanded && !isEmpty && (
        <div className="ml-4 border-l border-gray-200 pl-4">
          {items.map((item, index) => {
            const key = isArray ? index : item[0];
            const value = isArray ? item : item[1];
            return (
              <JsonViewer
                key={key}
                data={value}
                name={String(key)}
                level={level + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function JsonExplorer() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ExplorerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExplore = async () => {
    if (!url) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          mode: 'explore'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to explore: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h2 className="text-4xl font-extrabold text-gray-900 mb-6">JSON Explorer</h2>
      
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter property URL to explore"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-600"
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
          <Search size={20} className="mr-2" />
          {isLoading ? 'Exploring...' : 'Explore'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Page Information</h3>
            <p className="text-gray-900"><strong>URL:</strong> {data.url}</p>
            <p className="text-gray-900"><strong>Detected Site:</strong> {data.detectedSite}</p>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Extracted JSON Data</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              {Object.entries(data.extractedData).map(([key, value]) => (
                <div key={key} className="mb-4 last:mb-0">
                  <JsonViewer data={value} name={key} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}