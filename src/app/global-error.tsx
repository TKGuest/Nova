'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Nova Global Error]', error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: '#1e1e1e', fontFamily: 'monospace' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '700px',
            width: '100%',
            background: '#252526',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '16px',
            padding: '32px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔥</div>
            <h1 style={{ color: 'white', fontSize: '24px', marginBottom: '8px' }}>Critical App Error</h1>
            <p style={{ color: '#9ca3af', marginBottom: '24px', fontSize: '14px' }}>
              The root layout crashed. This is the exact error:
            </p>
            <div style={{
              background: '#1e1e1e',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '24px',
              overflowX: 'auto',
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              <p style={{ color: '#f87171', fontSize: '14px', fontWeight: 'bold', margin: 0 }}>{error.message}</p>
              {error.stack && (
                <pre style={{ color: 'rgba(252,165,165,0.5)', fontSize: '11px', marginTop: '8px', whiteSpace: 'pre-wrap' }}>{error.stack}</pre>
              )}
            </div>
            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
