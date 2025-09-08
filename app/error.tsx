'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw, Settings } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Application error:', error);
    }
  }, [error]);

  // Check for specific error types
  const isSupabaseError = error.message?.includes('Supabase') || 
                          error.message?.includes('configuration');
  const isAPIError = error.message?.includes('API') || 
                     error.message?.includes('fetch');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="max-w-2xl w-full px-6 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-600" />
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Oops! Something went wrong
          </h1>

          {/* Error Description */}
          <div className="text-center mb-8">
            {isSupabaseError ? (
              <div className="space-y-3">
                <p className="text-gray-600">
                  The database connection is not configured properly.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                  <p className="text-sm font-semibold text-amber-800 mb-2">
                    Missing Configuration:
                  </p>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Check Supabase environment variables in Vercel</li>
                    <li>• Ensure NEXT_PUBLIC_SUPABASE_URL is set</li>
                    <li>• Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is correct</li>
                  </ul>
                </div>
              </div>
            ) : isAPIError ? (
              <div className="space-y-3">
                <p className="text-gray-600">
                  There was a problem connecting to the API.
                </p>
                <p className="text-sm text-gray-500">
                  This might be a temporary issue. Please try again.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-600">
                  An unexpected error occurred while loading this page.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg text-left">
                    <p className="text-xs font-mono text-gray-700 break-all">
                      {error.message}
                    </p>
                    {error.digest && (
                      <p className="text-xs text-gray-500 mt-2">
                        Error ID: {error.digest}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </div>

          {/* Help Section */}
          {isSupabaseError && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  <Settings className="w-4 h-4 inline mr-1" />
                  How to fix this in Vercel:
                </h3>
                <ol className="text-sm text-blue-800 space-y-1 ml-5">
                  <li>1. Go to your Vercel Dashboard</li>
                  <li>2. Navigate to Settings → Environment Variables</li>
                  <li>3. Add the required Supabase variables</li>
                  <li>4. Redeploy your application</li>
                </ol>
                <p className="text-xs text-blue-700 mt-3">
                  See <code className="bg-blue-100 px-1 py-0.5 rounded">.env.production.example</code> for the exact values
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Support Link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Need help? Check the{' '}
          <Link href="/settings" className="text-blue-600 hover:underline">
            Settings page
          </Link>{' '}
          or{' '}
          <a
            href="https://github.com/eimribar/job-scraper"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            view documentation
          </a>
        </p>
      </div>
    </div>
  );
}