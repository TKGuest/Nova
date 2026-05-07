import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { SidePeek } from '@/components/layout/SidePeek';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { CalendarProvider } from '@/context/CalendarContext';
import { Header } from '@/components/layout/Header';
import { NotificationProvider } from '@/context/NotificationContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Notion cloned workspace with offline support and syncing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
        <AuthProvider>
          <NotificationProvider>
            <WorkspaceProvider>
            <CalendarProvider>
              <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
                  <Header />
                  <div className="flex-1 overflow-y-auto">
                    {children}
                  </div>
                  <SidePeek />
                  <SettingsModal />
                </main>
              </div>
            </CalendarProvider>
          </WorkspaceProvider>
        </NotificationProvider>
      </AuthProvider>
      </body>
    </html>
  );
}
