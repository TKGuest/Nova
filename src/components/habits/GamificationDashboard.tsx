'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { HabitStats, InventoryItem } from '@/types';
import { Shield, Clock, Timer, Banknote, Plus, Minus, ArrowRight, Play } from 'lucide-react';
import { showToast } from '@/components/ui/Toast';
import { customConfirm } from '@/components/ui/Modals';

export function GamificationDashboard({ pageId }: { pageId: string }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activeTimer, setActiveTimer] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !pageId) return;

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

  if (!stats) return <div className="text-gray-500 p-4 animate-pulse">Loading gamification engine...</div>;

  const handleBuyItem = async (itemConfig: { id: string, name: string, type: 'buff' | 'timer' | 'note' | 'instant', cost: number }) => {
    if (!user) return;
    if (stats.debt || stats.points < itemConfig.cost) {
      showToast('Not enough points or in Debt Mode!', 'error');
      return;
    }

    customConfirm({
      title: `Purchase ${itemConfig.name}?`,
      message: `This will cost ${itemConfig.cost} points.`,
      confirmLabel: 'Buy',
      onConfirm: async () => {
        const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
        await updateDoc(statsRef, { points: stats.points - itemConfig.cost });

        const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
        const existingItem = inventory.find(i => i.id === itemConfig.id);
        
        let newItems = [...inventory];
        if (existingItem) {
          newItems = newItems.map(i => i.id === itemConfig.id ? { ...i, quantity: i.quantity + 1, costPurchased: itemConfig.cost } : i);
        } else {
          newItems.push({
            id: itemConfig.id,
            name: itemConfig.name,
            type: itemConfig.type,
            quantity: 1,
            costPurchased: itemConfig.cost
          });
        }
        
        await updateDoc(invRef, { items: newItems });
        showToast(`${itemConfig.name} purchased!`, 'success');
      }
    });
  };

  const handleDepositToVault = async () => {
    if (!user) return;
    const amount = prompt('How many points to deposit into Vault? (1 point = 1 VND)');
    if (!amount || isNaN(Number(amount))) return;
    
    const numAmount = parseInt(amount);
    if (numAmount <= 0 || numAmount > stats.points) {
      showToast('Invalid amount', 'error');
      return;
    }

    const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    await updateDoc(statsRef, {
      points: stats.points - numAmount,
      vaultBalance: stats.vaultBalance + numAmount
    });
    showToast(`Deposited ${numAmount} to Vault`, 'success');
  };

  const handleWithdrawFromVault = async () => {
    if (!user) return;
    const amount = prompt('How much to withdraw? (Spend in real life)');
    if (!amount || isNaN(Number(amount))) return;
    
    const numAmount = parseInt(amount);
    if (numAmount <= 0 || numAmount > stats.vaultBalance) {
      showToast('Invalid amount or insufficient funds', 'error');
      return;
    }

    const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    await updateDoc(statsRef, {
      vaultBalance: stats.vaultBalance - numAmount
    });
    showToast(`Spent ${numAmount} VND from Vault`, 'success');
  };

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

    // Determine duration based on ID
    let minutes = 10;
    if (item.id === 'timer_10') minutes = 10;

    // Remove from inventory
    const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
    const newItems = inventory.map(i => {
      if (i.id === item.id) return { ...i, quantity: i.quantity - 1 };
      return i;
    }).filter(i => i.quantity > 0);
    await updateDoc(invRef, { items: newItems });

    showToast(`Started ${minutes}-minute timer!`, 'success');

    const durationMs = minutes * 60 * 1000;
    const endTime = Date.now() + durationMs;
    setActiveTimer(endTime);

    const interval = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        setActiveTimer(null);
        new Notification("Focus Session Complete!", {
          body: "Your gamification timer has finished.",
          icon: "/icon-192x192.png" // assuming standard PWA icon exists
        });
      }
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 p-4">
      
      {/* Left Column: Stats & Inventory */}
      <div className="flex-1 space-y-6">
        
        {/* Stats Card */}
        <div className="bg-[#1a1a1a] border border-purple-900/40 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-bl-full blur-2xl group-hover:bg-purple-600/20 transition-all"></div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-purple-400 mb-6 flex items-center gap-2">
            <Shield size={16} /> RPG Status
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className={`bg-[#111] border ${stats.debt ? 'border-red-500/50' : 'border-[#2d2d2d]'} rounded-lg p-4 relative`}>
              {stats.debt && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.6)]">DEBT MODE</div>}
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Available Points</span>
              <span className={`text-3xl font-black ${stats.debt ? 'text-red-500' : 'text-white'}`}>{stats.points.toLocaleString()}</span>
            </div>
            
            <div className="bg-[#111] border border-[#2d2d2d] rounded-lg p-4">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Streak Multiplier</span>
              <span className="text-3xl font-black text-green-400">{stats.streakMultiplier.toFixed(2)}x</span>
            </div>
            
            <div className="col-span-2 bg-gradient-to-r from-[#111] to-purple-900/10 border border-[#2d2d2d] border-l-purple-500 rounded-lg p-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Vault Balance (VND)</span>
                <span className="text-3xl font-black text-yellow-400">{stats.vaultBalance.toLocaleString()} đ</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={handleDepositToVault} className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors"><Plus size={18}/></button>
                 <button onClick={handleWithdrawFromVault} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"><Minus size={18}/></button>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Card */}
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-6">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Inventory</h2>
          {inventory.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#333] rounded-lg text-gray-500 text-sm">
              Your inventory is empty.
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-[#111] border border-[#222] rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.type === 'buff' ? <Shield size={16} className="text-blue-400" /> : <Timer size={16} className="text-orange-400" />}
                    <span className="text-sm font-medium text-gray-200">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold bg-[#222] px-2 py-1 rounded text-gray-400">x{item.quantity}</span>
                    {item.type === 'timer' && (
                      <button onClick={() => handleActivateTimer(item)} className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors" title="Activate Timer">
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

      {/* Right Column: The Shop */}
      <div className="flex-1 space-y-6">
         <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-6 h-full flex flex-col">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-yellow-500 mb-6 flex items-center gap-2">
              <Banknote size={16} /> Item Shop
            </h2>
            
            <div className="grid gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
               {/* Pre-defined Shop Items */}
               <ShopItem 
                  title="Streak Insurance" 
                  desc="Prevents your streak multiplier from resetting for 1 missed day." 
                  cost={500} 
                  icon={<Shield size={20} className="text-blue-400" />} 
                  onBuy={() => handleBuyItem({ id: 'insurance_1', name: 'Streak Insurance', type: 'buff', cost: 500 })}
               />
               <ShopItem 
                  title="Skip Day (Holiday)" 
                  desc="Take a break without penalty. Stats are frozen for the day." 
                  cost={1000} 
                  icon={<Clock size={20} className="text-orange-400" />} 
                  onBuy={() => handleBuyItem({ id: 'skip_1', name: 'Holiday Pass', type: 'buff', cost: 1000 })}
               />
               <ShopItem 
                  title="Timer (10 mins)" 
                  desc="Activate a focus timer. Alerts you even in the background." 
                  cost={100} 
                  icon={<Timer size={20} className="text-green-400" />} 
                  onBuy={() => handleBuyItem({ id: 'timer_10', name: '10 Min Focus Timer', type: 'timer', cost: 100 })}
               />
            </div>
         </div>
      </div>

    </div>
  );
}

function ShopItem({ title, desc, cost, icon, onBuy }: { title: string, desc: string, cost: number, icon: React.ReactNode, onBuy: () => void }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-[#111] border border-[#2d2d2d] rounded-xl hover:border-purple-500/50 transition-colors group">
      <div className="p-3 bg-[#1a1a1a] rounded-lg group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-gray-200">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
      </div>
      <button 
        onClick={onBuy}
        className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition-colors"
      >
        {cost} <span className="opacity-70 text-[10px]">pts</span>
      </button>
    </div>
  );
}
