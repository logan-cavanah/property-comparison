import Link from 'next/link';
import { Plus, GitCompare, Trophy } from 'lucide-react';

export default function Home() {
  return (
    <div className="text-center space-y-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">
        Property Comparison App
      </h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        <Link 
          href="/add" 
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          <Plus className="mx-auto mb-4 text-blue-600" size={48} />
          <h2 className="text-xl font-semibold mb-2">Add Properties</h2>
          <p className="text-gray-600">Add property URLs to the comparison pool</p>
        </Link>
        
        <Link 
          href="/compare" 
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          <GitCompare className="mx-auto mb-4 text-blue-600" size={48} />
          <h2 className="text-xl font-semibold mb-2">Compare Properties</h2>
          <p className="text-gray-600">Choose between property pairs</p>
        </Link>
        
        <Link 
          href="/rankings" 
          className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          <Trophy className="mx-auto mb-4 text-blue-600" size={48} />
          <h2 className="text-xl font-semibold mb-2">View Rankings</h2>
          <p className="text-gray-600">See how properties rank</p>
        </Link>
      </div>
    </div>
  );
}
