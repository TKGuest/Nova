'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Nova Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#1e1e1e] flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl w-full bg-[#252526] border border-red-500/30 rounded-xl p-8 shadow-2xl">
        <div className="text-red-500 text-5xl mb-4">⚠</div>
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-gray-400 mb-6 text-sm">A runtime error occurred. The message below will help diagnose the issue:</p>
        <div className="bg-[#1e1e1e] border border-red-500/20 rounded-lg p-4 text-left mb-6 overflow-auto max-h-64">
          <p className="text-red-400 font-mono text-sm font-bold">{error.message}</p>
          {error.stack && (
            <pre className="text-red-300/60 font-mono text-xs mt-2 whitespace-pre-wrap">{error.stack}</pre>
          )}
          {error.digest && (
            <p className="text-gray-500 text-xs mt-2">Digest: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
