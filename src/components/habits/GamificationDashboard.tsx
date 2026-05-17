'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { HabitStats, InventoryItem } from '@/types';
import { Shield, Clock, Timer, Play, ShoppingBag, Sparkles } from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';

export function GamificationDashboard({ 
  pageId, 
  onOpenShop 
}: { 
  pageId: string;
  onOpenShop?: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!user || !pageId) return;

    // Listen to gamification stats
    const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    const unsubStats = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        setStats(docSnap.data() as HabitStats);
      } else {
        // Init default stats
        const defaultStats: HabitStats = {
          points: 0,
          vaultBalance: 0,
          streakMultiplier: 1.0,
          debt: false,
          lastDecayDate: new Date().toISOString(),
          lastStreakReset: new Date().toISOString(),
          equippedBuffs: []
        };
        setDoc(statsRef, defaultStats);
        setStats(defaultStats);
      }
    });

    // Listen to inventory
    const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
    const unsubInv = onSnapshot(invRef, (docSnap) => {
      if (docSnap.exists()) {
        setInventory(docSnap.data().items || []);
      } else {
        setDoc(invRef, { items: [] });
        setInventory([]);
      }
    });

    return () => {
      unsubStats();
      unsubInv();
    };
  }, [user, pageId]);

  useEffect(() => {
    if (!activeTimer) {
      setTimeLeft('');
      return;
    }
    const updateClock = () => {
      const diff = activeTimer - Date.now();
      if (diff <= 0) {
        setTimeLeft('');
        setActiveTimer(null);
      } else {
        const totalSecs = Math.floor(diff / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!stats) return <div className="text-gray-500 p-4 animate-pulse">Loading gamification engine...</div>;

  const handleActivateTimer = async (item: InventoryItem) => {
    if (!user) return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        showToast('Notification permission denied. Timer cannot run.', 'error');
        return;
      }
    }

    if (activeTimer) {
      showToast('A timer is already running!', 'error');
      return;
    }

    // Determine duration in minutes based on durationHours or fallback to 10
    let minutes = item.durationHours ? Math.round(item.durationHours * 60) : 10;
    if (!item.durationHours && item.id === 'timer_10') minutes = 10;

    // Remove 1 quantity from inventory
    const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
    const newItems = inventory.map(i => {
      if (i.id === item.id) return { ...i, quantity: i.quantity - 1 };
      return i;
    }).filter(i => i.quantity > 0);
    await updateDoc(invRef, { items: newItems });

    showToast(`Started ${minutes}-minute focus timer!`, 'success');

    const durationMs = minutes * 60 * 1000;
    const endTime = Date.now() + durationMs;
    setActiveTimer(endTime);

    const checkFinished = setTimeout(() => {
      setActiveTimer(null);
      new Notification("Focus Session Complete!", {
        body: "Your gamification timer has finished.",
        icon: "/icon-192x192.png" 
      });
    }, durationMs);
  };

  const handleActivateBuff = async (item: InventoryItem) => {
    if (!user || !stats) return;

    const now = new Date();
    const activeBuffs = stats.equippedBuffs || [];
    const alreadyActive = activeBuffs.some(b => b.id === item.id && new Date(b.expiresAt) > now);
    if (alreadyActive) {
      showToast(`${item.name} is already active today!`, 'error');
      return;
    }

    // Set expiration to 23:59:59.999 of the current calendar day
    const expiresAt = new Date();
    expiresAt.setHours(23, 59, 59, 999);

    // Decrement inventory
    const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
    const newItems = inventory.map(i => {
      if (i.id === item.id) return { ...i, quantity: i.quantity - 1 };
      return i;
    }).filter(i => i.quantity > 0);
    await updateDoc(invRef, { items: newItems });

    // Equip buff
    const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    const newBuffs = [
      ...activeBuffs.filter(b => new Date(b.expiresAt) > now), // discard expired ones
      {
        id: item.id,
        name: item.name,
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    ];
    await updateDoc(statsRef, { equippedBuffs: newBuffs });

    showToast(`${item.name} active until day end!`, 'success');
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {/* Left Column: Stats */}
      <div className="bg-[#1a1a1a] border border-purple-900/40 rounded-xl p-6 shadow-2xl relative overflow-hidden group flex flex-col justify-between text-left">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-bl-full blur-2xl group-hover:bg-purple-600/20 transition-all"></div>
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
            <Shield size={16} /> RPG Status
          </h2>
          {onOpenShop && (
            <button 
              onClick={onOpenShop}
              className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 active:scale-95 shrink-0"
            >
              <ShoppingBag size={14} /> Open Item Shop
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className={`bg-[#111] border ${stats.debt ? 'border-red-500/50' : 'border-[#2d2d2d]'} rounded-lg p-4 relative flex flex-col justify-center`}>
            {stats.debt && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.6)]">DEBT MODE</div>}
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Available Points</span>
            <span className={`text-3xl font-black ${stats.debt ? 'text-red-500' : 'text-white'}`}>{stats.points.toLocaleString()}</span>
          </div>
          
          <div className="bg-[#111] border border-[#2d2d2d] rounded-lg p-4 flex flex-col justify-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Status Level</span>
            <span className="text-2xl font-black text-green-400">
              {stats.points < 100 ? 'Novice' : stats.points < 500 ? 'Adventurer' : stats.points < 2000 ? 'Hero' : 'Legend'}
            </span>
          </div>
        </div>

        {timeLeft && (
          <div className="mt-4 pt-4 border-t border-[#2d2d2d] text-left">
            <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider block mb-1.5">Focus Timer Active</span>
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg text-xs font-black text-green-400 uppercase tracking-wider animate-pulse w-fit">
              <Timer size={14} className="animate-spin" style={{ animationDuration: '3s' }} /> {timeLeft} Remaining
            </div>
          </div>
        )}

        {stats.equippedBuffs && stats.equippedBuffs.filter(b => new Date(b.expiresAt) > new Date()).length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#2d2d2d] text-left">
            <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider block mb-1.5">Active Buffs (Day End Expiry)</span>
            <div className="flex flex-wrap gap-1.5">
              {stats.equippedBuffs.filter(b => new Date(b.expiresAt) > new Date()).map(b => (
                <div key={b.id} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-1.5 rounded-lg text-[9px] font-black text-blue-400 uppercase tracking-wider animate-pulse">
                  <Shield size={11} /> {b.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Inventory */}
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-6 h-full flex flex-col justify-between min-h-[220px] text-left">
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Inventory</h2>
          {inventory.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#333] rounded-lg text-gray-500 text-sm">
              Your inventory is empty.
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
              {inventory.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-[#111] border border-[#222] rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.type === 'buff' && <Shield size={16} className="text-blue-400" />}
                    {item.type === 'timer' && <Timer size={16} className="text-green-400" />}
                    {item.type === 'note' && <Sparkles size={16} className="text-purple-400" />}
                    {item.type === 'instant' && <Clock size={16} className="text-orange-400" />}
                    <span className="text-sm font-medium text-gray-200">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-[#222] px-2 py-1 rounded text-gray-400">x{item.quantity}</span>
                    {item.type === 'timer' && (
                      <button onClick={() => handleActivateTimer(item)} className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors" title="Activate Focus Timer">
                        <Play size={14} />
                      </button>
                    )}
                    {item.type === 'buff' && (
                      <button onClick={() => handleActivateBuff(item)} className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors" title="Activate Buff (Day End Expiry)">
                        <Play size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
