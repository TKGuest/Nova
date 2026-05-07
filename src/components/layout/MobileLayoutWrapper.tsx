'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export function MobileLayoutWrapper({ sidebar, main }: { sidebar: React.ReactNode, main: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <div className="flex h-[100dvh] overflow-hidden w-full">
      <div className={`shrink-0 h-full overflow-hidden ${isHome ? 'w-full block' : 'hidden md:block w-64'} touch-pan-y`}>
        {sidebar}
      </div>
      <main className={`flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden ${isHome ? 'hidden md:flex' : 'flex'}`}>
        {main}
      </main>
    </div>
  );
}
