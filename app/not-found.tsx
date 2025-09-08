import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full px-6 py-8 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-4">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h1 className="text-6xl font-bold text-slate-900 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-slate-700 mb-4">
            Page Not Found
          </h2>
          <p className="text-slate-600 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="space-y-3">
          <Link 
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          
          <Link 
            href="/companies"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            View Companies
          </Link>
        </div>
        
        <p className="text-sm text-slate-500 mt-8">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}