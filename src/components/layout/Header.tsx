'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { format, addDays, startOfDay, differenceInSeconds } from 'date-fns';
import { Clock, Globe, Zap, Settings2, ChevronLeft } from 'lucide-react';
import { Link, usePathname } from '@/context/RouterContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function Header() {
  const { settings } = useWorkspace();
  const [now, setNow] = useState(new Date());
  const { user } = useAuth();
  const pathname = usePathname();
  const [streakData, setStreakData] = useState<{ currentStreak: number; longestStreak: number; lastActiveDate?: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setStreakData(null);
      return;
    }

    let pageId = '';
    if (pathname.startsWith('/page/')) {
      pageId = pathname.slice('/page/'.length);
    }
    
    if (!pageId) {
      setStreakData(null);
      return;
    }

    const docRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setStreakData({
          currentStreak: d.currentStreak ?? 0,
          longestStreak: d.longestStreak ?? 0,
          lastActiveDate: d.lastActiveDate || '',
        });
      } else {
        setStreakData({ currentStreak: 0, longestStreak: 0 });
      }
    }, () => {
      // ignore
    });

    return () => unsub();
  }, [user, pathname]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getUTCString = () => {
    return format(now, 'HH:mm:ss') + ' UTC';
  };

  const getCountdown = () => {
    const localNow = new Date();
    let resetTime = startOfDay(localNow);
    resetTime.setHours(settings.resetHour || 0);

    // If reset time for today has passed, move to tomorrow
    if (localNow >= resetTime) {
      resetTime = addDays(resetTime, 1);
    }

    const diff = differenceInSeconds(resetTime, localNow);
    
    // Trigger Lazy Reset event at 00:00:00
    if (diff === 0) {
      window.dispatchEvent(new Event('daily-reset'));
    }

    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="h-14 border-b border-[#2d2d2d] bg-[#1e1e1e] flex items-center justify-between px-6 shrink-0 select-none z-50 relative">
      <div className="flex items-center gap-4">
        {/* Mobile Back Button */}
        <Link href="/" className="md:hidden flex items-center gap-1 text-gray-400 hover:text-gray-200 bg-[#252526] px-2 py-1.5 rounded-md border border-[#3e3e3e]">
          <ChevronLeft size={18} />
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* UTC Clock */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#252526] border border-[#3e3e3e] rounded-md shadow-sm">
          <Globe size={14} className="text-blue-400" />
          <span className="text-[11px] font-bold text-gray-300 font-mono tracking-wider">
            {now.toUTCString().split(' ')[4]} UTC
          </span>
        </div>

        {/* Streak Badge */}
        {streakData && (
          <div 
            className="flex items-center gap-1.5 px-3 py-1 bg-[#252526] border border-[#3e3e3e] rounded-md text-[11px] font-black uppercase tracking-wider relative group/flame cursor-help select-none shrink-0"
          >
            <span className={`text-[12px] md:text-[14px] leading-none transition-all ${streakData.currentStreak > 0 ? 'text-amber-500 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-zinc-600'}`}>
              🔥
            </span>
            <span className={`font-mono text-[11px] font-black ${streakData.currentStreak > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
              {streakData.currentStreak}
            </span>
            
            {/* Tooltip */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#141414] border border-[#2d2d2d] text-gray-300 text-[10px] py-1.5 px-3 rounded-md shadow-2xl opacity-0 group-hover/flame:opacity-100 pointer-events-none transition-all z-[999] whitespace-nowrap font-bold normal-case">
              Longest Streak: <span className="text-amber-400">{streakData.longestStreak} days</span> {streakData.currentStreak > 0 && streakData.lastActiveDate === format(new Date(), 'yyyy-MM-dd') ? ' (Secured today!)' : ''}
            </div>
          </div>
        )}

        {/* Countdown Module */}
        <div className="flex flex-col items-end min-w-[120px]">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-gray-500">Next Reset In</span>
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          </div>
          <div className="text-base font-black text-white font-mono tracking-[0.2em]">
            {getCountdown()}
          </div>
        </div>
      </div>
    </header>
  );
}
