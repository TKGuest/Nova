'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export default function Home() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <main className="min-h-full flex items-center justify-center bg-background text-gray-500">
      <div className="text-center mt-32">
        <h2 className="text-xl mb-4">You're in your Workspace!</h2>
        <p>Select a page from the sidebar or click "Add New" to get started.</p>
      </div>
    </main>
  );
}
