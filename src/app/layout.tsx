import type { Metadata, Viewport } from 'next';
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
import { MobileLayoutWrapper } from '@/components/layout/MobileLayoutWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workspace',
  description: 'Notion cloned workspace with offline support and syncing',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
              <MobileLayoutWrapper 
                sidebar={<Sidebar />}
                main={
                  <>
                    <Header />
                    <div className="flex-1 flex flex-col min-h-0">
                      {children}
                    </div>
                    <SidePeek />
                    <SettingsModal />
                  </>
                }
              />
            </CalendarProvider>
          </WorkspaceProvider>
        </NotificationProvider>
      </AuthProvider>
      </body>
    </html>
  );
}
