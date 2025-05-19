'use client';

import { useState } from 'react';
import { Search, Code, FileText } from 'lucide-react';

interface ScriptContent {
  index: number;
  preview: string;
  length: number;
}

interface ExplorerResponse {
  url: string;
  detectedSite: string;
  scriptContents: ScriptContent[];
  extractedData: Record<string, any>;
}

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
      <h2 className="text-2xl font-bold mb-4">JSON Explorer</h2>
      
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter property URL to explore"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <h3 className="text-lg font-semibold mb-2">Page Information</h3>
            <p><strong>URL:</strong> {data.url}</p>
            <p><strong>Detected Site:</strong> {data.detectedSite}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Script Contents</h3>
            <div className="space-y-4">
              {data.scriptContents.map((script) => (
                <div key={script.index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Script #{script.index + 1}</span>
                    <span className="text-sm text-gray-500">{script.length} characters</span>
                  </div>
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                    {script.preview}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Extracted Data</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(data.extractedData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}