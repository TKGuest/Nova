'use client';

import React, { useEffect } from 'react';
import { RouterProvider, usePathname } from '@/context/RouterContext';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { NotificationProvider } from '@/context/NotificationContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidePeek } from '@/components/layout/SidePeek';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { MobileLayoutWrapper } from '@/components/layout/MobileLayoutWrapper';
import DynamicPage from '@/app/page/[pageId]/page';
import CalendarPage from '@/app/calendar/page';
import Home from '@/app/page.tsx';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, query } from 'firebase/firestore';
import { PageModel } from './types';

function AppContent() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((reg) => {
          console.log('[App] SW registered:', reg.scope);
        })
        .catch((err) => {
          console.error('[App] SW registration failed:', err);
        });
    }

    // Dynamic multi-document listener for reminders and habits
    const pagesRef = collection(db, 'users', user.uid, 'pages');
    const qPages = query(pagesRef);

    let reminderUnsubs: (() => void)[] = [];
    let statsUnsubs: (() => void)[] = [];

    const unsubPages = onSnapshot(qPages, (pagesSnap) => {
      // Clear old subcollection subscriptions
      reminderUnsubs.forEach(u => u());
      reminderUnsubs = [];
      statsUnsubs.forEach(u => u());
      statsUnsubs = [];

      const activePages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as PageModel)).filter(p => !p.deletedAt);

      const habitPages = activePages.filter(p => p.type === 'habit');

      const allSyncedReminders: any[] = [];

      const syncToSW = () => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if (reg.active) {
              reg.active.postMessage({
                type: 'SYNC_REMINDERS',
                reminders: allSyncedReminders
              });
            }
          }).catch(console.error);
        }
      };

      // 1. Subscribe to each active page's reminders subcollection
      activePages.forEach(p => {
        const rRef = collection(db, 'users', user.uid, 'pages', p.id, 'reminders');
        const unsub = onSnapshot(rRef, (snap) => {
          const pageReminderIds = snap.docs.map(doc => doc.id);
          for (let i = allSyncedReminders.length - 1; i >= 0; i--) {
            if (allSyncedReminders[i].pageId === p.id && !pageReminderIds.includes(allSyncedReminders[i].id)) {
              allSyncedReminders.splice(i, 1);
            }
          }

          snap.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.active) {
              const existingIdx = allSyncedReminders.findIndex(item => item.id === docSnap.id);
              const formatted = {
                id: docSnap.id,
                pageId: p.id,
                type: data.type,
                title: data.title,
                body: data.body || '',
                time: data.time || '',
                dateTime: data.dateTime || '',
                active: data.active
              };
              if (existingIdx >= 0) {
                allSyncedReminders[existingIdx] = formatted;
              } else {
                allSyncedReminders.push(formatted);
              }
            }
          });

          syncToSW();
        });
        reminderUnsubs.push(unsub);
      });

      // 2. Subscribe to each habit page's active timers
      habitPages.forEach(p => {
        const statsRef = doc(db, 'users', user.uid, 'pages', p.id, 'gamification', 'stats');
        const unsub = onSnapshot(statsRef, (docSnap) => {
          if (docSnap.exists()) {
            const d = docSnap.data();
            if (d.activeTimerEndTime && d.activeTimerEndTime > Date.now()) {
              const timerId = `timer-${p.id}`;
              const existingIdx = allSyncedReminders.findIndex(item => item.id === timerId);
              const formatted = {
                id: timerId,
                pageId: p.id,
                type: 'timer',
                title: d.activeTimerName ? `${d.activeTimerName} Completed!` : 'Focus Timer Finished!',
                body: 'Your daily habit shop timer item has run out.',
                endTime: new Date(d.activeTimerEndTime).toISOString(),
                active: true
              };

              if (existingIdx >= 0) {
                allSyncedReminders[existingIdx] = formatted;
              } else {
                allSyncedReminders.push(formatted);
              }
            } else {
              const timerId = `timer-${p.id}`;
              const existingIdx = allSyncedReminders.findIndex(item => item.id === timerId);
              if (existingIdx >= 0) {
                allSyncedReminders.splice(existingIdx, 1);
              }
            }
            syncToSW();
          }
        });
        statsUnsubs.push(unsub);
      });
    });

    return () => {
      unsubPages();
      reminderUnsubs.forEach(u => u());
      statsUnsubs.forEach(u => u());
    };
  }, [user]);

  // Simple, deterministic route matching
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  let view = <Home />;
  if (normalizedPath === '/calendar') {
    view = <CalendarPage />;
  } else if (normalizedPath === '/settings') {
    view = <SettingsPage />;
  } else if (normalizedPath.startsWith('/page/')) {
    view = <DynamicPage />;
  }

  return (
    <div className="dark bg-[#1e1e1e] text-foreground h-screen w-screen overflow-hidden flex flex-col font-sans">
      <MobileLayoutWrapper 
        sidebar={<Sidebar />}
        main={
          <>
            <Header />
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              {view}
            </div>
          </>
        }
      />
      <SidePeek />
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <NotificationProvider>
          <WorkspaceProvider>
            <CalendarProvider>
              <AppContent />
            </CalendarProvider>
          </WorkspaceProvider>
        </NotificationProvider>
      </AuthProvider>
    </RouterProvider>
  );
}
