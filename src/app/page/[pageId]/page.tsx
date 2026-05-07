'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageModel } from '@/components/layout/Sidebar';
import { WordEditor } from '@/components/editor/WordEditor';
import { HabitTracker } from '@/components/habits/HabitTracker';
import { Loader2 } from 'lucide-react';
import { CoverImage } from '@/components/ui/CoverImage';

export default function DynamicPage() {
  const params = useParams();
  const pageId = params.pageId as string;
  const { user } = useAuth();
  
  const [pageMeta, setPageMeta] = useState<PageModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !pageId) return;

    const docRef = doc(db, 'users', user.uid, 'pages', pageId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setPageMeta({ id: docSnap.id, ...docSnap.data() } as PageModel);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, pageId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center pt-32">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (!pageMeta) {
    return (
      <div className="flex flex-col h-full items-center justify-center pt-32 text-gray-500">
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p>This page may have been deleted.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1e1e1e]">
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
        <CoverImage pageId={pageId} coverImage={pageMeta.coverImage} />
        <div className="max-w-7xl mx-auto px-6 md:px-20 py-10">
          <h1 className="text-4xl font-bold text-foreground mb-8 outline-none break-words overflow-hidden">
            {pageMeta.title}
          </h1>
          <div className="min-h-0">
            {pageMeta.type === 'note' ? (
              <WordEditor pageId={pageId} />
            ) : (
              <HabitTracker pageId={pageId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
