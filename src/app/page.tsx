'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from '@/context/RouterContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'pages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const activePages = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((p: any) => !p.deletedAt);

      if (activePages.length > 0) {
        // Find habit page first, or fallback to first page
        const habitPage = activePages.find((p: any) => p.type === 'habit');
        const targetPage = habitPage || activePages[0];
        router.replace(`/page/${targetPage.id}`);
      }
    });

    return () => unsub();
  }, [user, router]);

  if (!user) return null;

  return (
    <main className="min-h-full flex items-center justify-center bg-background text-gray-500 hidden md:flex">
      <div className="text-center mt-32">
        <h2 className="text-xl mb-4 text-gray-300">Loading Workspace...</h2>
      </div>
    </main>
  );
}
