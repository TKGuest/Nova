'use client';

import React from 'react';
import { RouterProvider, usePathname } from '@/context/RouterContext';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { NotificationProvider } from '@/context/NotificationContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidePeek } from '@/components/layout/SidePeek';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { MobileLayoutWrapper } from '@/components/layout/MobileLayoutWrapper';
import DynamicPage from '@/app/page/[pageId]/page';
import CalendarPage from '@/app/calendar/page';
import Home from '@/app/page.tsx';

function AppContent() {
  const pathname = usePathname();

  // Simple, deterministic route matching
  let view = <Home />;
  if (pathname === '/calendar') {
    view = <CalendarPage />;
  } else if (pathname.startsWith('/page/')) {
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
            <SidePeek />
            <SettingsModal />
          </>
        }
      />
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
