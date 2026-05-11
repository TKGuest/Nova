'use client';

import { useEffect } from 'react';

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Nova Page Error]', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-[#252526] border border-red-500/30 rounded-xl p-8 shadow-2xl text-center">
        <div className="text-red-500 text-4xl mb-4">⚠</div>
        <h2 className="text-xl font-bold text-white mb-2">Page failed to load</h2>
        <p className="text-gray-400 text-sm mb-4">Error: <span className="text-red-400 font-mono">{error.message}</span></p>
        {error.stack && (
          <pre className="bg-[#1e1e1e] text-red-300/60 text-xs rounded p-3 text-left overflow-auto max-h-40 mb-4 whitespace-pre-wrap">{error.stack}</pre>
        )}
        <button onClick={reset} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>
    </div>
  );
}
