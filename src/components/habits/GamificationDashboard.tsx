'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { HabitStats, InventoryItem, ShopItem } from '@/types';
import { Shield, Clock, Timer, Banknote, Plus, Minus, ArrowRight, Play, ShoppingBag, X, Trash2, Edit2, Sparkles, AlertCircle } from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';
import { InputDialog, Modal } from '@/components/ui/Modals';

export function GamificationDashboard({ pageId }: { pageId: string }) {
  const { user } = useAuth();
  const { showToast, confirm: customConfirm } = useNotification();
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [newItemModal, setNewItemModal] = useState(false);
  
  const [inputDialog, setInputDialog] = useState<{ isOpen: boolean, title: string, message: string, type: string, onSubmit: (val: string) => void } | null>(null);

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

    // Listen to custom shop items (seeds if empty)
    const shopRef = collection(db, 'users', user.uid, 'pages', pageId, 'shop_items');
    const unsubShop = onSnapshot(shopRef, async (snapshot) => {
      if (snapshot.empty) {
        // Seed default items
        const defaultItems = [
          {
            name: 'Streak Insurance',
            description: 'Prevents your streak multiplier from resetting for 1 missed day.',
            cost: 500,
            type: 'buff',
            durationHours: 24
          },
          {
            name: 'Holiday Pass (Skip Day)',
            description: 'Take a break without penalty. Stats are frozen for the day.',
            cost: 1000,
            type: 'buff',
            durationHours: 24
          },
          {
            name: '10 Min Focus Timer',
            description: 'Activate a focus timer. Alerts you even in the background.',
            cost: 100,
            type: 'timer',
            durationHours: 0.16
          }
        ];
        for (const item of defaultItems) {
          await addDoc(shopRef, item);
        }
      } else {
        setShopItems(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ShopItem)));
      }
    });

    return () => {
      unsubStats();
      unsubInv();
      unsubShop();
    };
  }, [user, pageId]);

  if (!stats) return <div className="text-gray-500 p-4 animate-pulse">Loading gamification engine...</div>;

  const handleBuyItem = async (item: ShopItem) => {
    if (!user) return;
    if (stats.debt || stats.points < item.cost) {
      showToast('Not enough points or in Debt Mode!', 'error');
      return;
    }

    customConfirm({
      title: `Purchase ${item.name}?`,
      message: `This will cost ${item.cost} points.`,
      confirmLabel: 'Buy',
      onConfirm: async () => {
        const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
        await updateDoc(statsRef, { points: stats.points - item.cost });

        const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
        const existingItem = inventory.find(i => i.id === item.id);
        
        let newItems = [...inventory];
        if (existingItem) {
          newItems = newItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1, costPurchased: item.cost } : i);
        } else {
          newItems.push({
            id: item.id,
            name: item.name,
            type: item.type,
            quantity: 1,
            costPurchased: item.cost
          });
        }
        
        await updateDoc(invRef, { items: newItems });
        showToast(`${item.name} purchased!`, 'success');
      }
    });
  };

  const handleDepositToVault = () => {
    if (!user) return;
    setInputDialog({
      isOpen: true,
      title: 'Deposit to Vault',
      message: 'How many points to deposit? (1 point = 1 VND)',
      type: 'number',
      onSubmit: async (amountStr) => {
        const numAmount = parseInt(amountStr);
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
      }
    });
  };

  const handleWithdrawFromVault = () => {
    if (!user) return;
    setInputDialog({
      isOpen: true,
      title: 'Withdraw from Vault',
      message: 'How much to withdraw? (Spend in real life)',
      type: 'number',
      onSubmit: async (amountStr) => {
        const numAmount = parseInt(amountStr);
        if (numAmount <= 0 || numAmount > stats.vaultBalance) {
          showToast('Invalid amount or insufficient funds', 'error');
          return;
        }

        const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
        await updateDoc(statsRef, {
          vaultBalance: stats.vaultBalance - numAmount
        });
        showToast(`Spent ${numAmount} VND from Vault`, 'success');
      }
    });
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
          icon: "/icon-192x192.png" 
        });
      }
    }, 1000);
  };

  const handleCreateShopItem = async (itemData: Omit<ShopItem, 'id'>) => {
    if (!user) return;
    try {
      const shopRef = collection(db, 'users', user.uid, 'pages', pageId, 'shop_items');
      await addDoc(shopRef, itemData);
      setNewItemModal(false);
      showToast('Item added to shop!', 'success');
    } catch (err) {
      showToast('Failed to create item', 'error');
    }
  };

  const handleUpdateShopItem = async (itemData: Omit<ShopItem, 'id'>) => {
    if (!user || !editingItem) return;
    try {
      const itemRef = doc(db, 'users', user.uid, 'pages', pageId, 'shop_items', editingItem.id);
      await updateDoc(itemRef, itemData as any);
      setEditingItem(null);
      showToast('Item updated!', 'success');
    } catch (err) {
      showToast('Failed to update item', 'error');
    }
  };

  const handleDeleteShopItem = async (itemId: string) => {
    if (!user) return;
    customConfirm({
      title: 'Delete Shop Item?',
      message: 'Are you sure you want to remove this item from the shop permanently?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          const itemRef = doc(db, 'users', user.uid, 'pages', pageId, 'shop_items', itemId);
          await deleteDoc(itemRef);
          showToast('Item deleted from shop', 'success');
        } catch (err) {
          showToast('Failed to delete item', 'error');
        }
      }
    });
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 p-4">
      {/* Left Column: Stats */}
      <div className="flex-1 space-y-6">
        <div className="bg-[#1a1a1a] border border-purple-900/40 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-bl-full blur-2xl group-hover:bg-purple-600/20 transition-all"></div>
          
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
              <Shield size={16} /> RPG Status
            </h2>
            <button 
              onClick={() => setIsShopOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/10 active:scale-95 shrink-0"
            >
              <ShoppingBag size={14} /> Open Item Shop
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className={`bg-[#111] border ${stats.debt ? 'border-red-500/50' : 'border-[#2d2d2d]'} rounded-lg p-4 relative`}>
              {stats.debt && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.6)]">DEBT MODE</div>}
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Available Points</span>
              <span className={`text-3xl font-black ${stats.debt ? 'text-red-500' : 'text-white'}`}>{stats.points.toLocaleString()}</span>
            </div>
            
            <div className="bg-[#111] border border-[#2d2d2d] rounded-lg p-4">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Status Level</span>
              <span className="text-3xl font-black text-green-400">
                {stats.points < 100 ? 'Novice' : stats.points < 500 ? 'Adventurer' : stats.points < 2000 ? 'Hero' : 'Legend'}
              </span>
            </div>
            
            <div className="col-span-2 bg-gradient-to-r from-[#111] to-purple-900/10 border border-[#2d2d2d] border-l-purple-500 rounded-lg p-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Vault Balance (VND)</span>
                <span className="text-3xl font-black text-yellow-400">{stats.vaultBalance.toLocaleString()} đ</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={handleDepositToVault} className="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors" title="Deposit points"><Plus size={18}/></button>
                 <button onClick={handleWithdrawFromVault} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors" title="Withdraw real life spend"><Minus size={18}/></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Inventory */}
      <div className="flex-1 space-y-6">
        <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-xl p-6 h-full flex flex-col justify-between min-h-[220px]">
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Inventory</h2>
            {inventory.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#333] rounded-lg text-gray-500 text-sm">
                Your inventory is empty.
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
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
      </div>

      {/* Side Peek Shop */}
      {isShopOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setIsShopOpen(false)} 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] transition-opacity duration-300 animate-fade-in"
          />
          
          {/* Shop Drawer */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#141414] border-l border-[#2d2d2d] z-[200] shadow-2xl p-6 flex flex-col h-full overflow-hidden transition-all duration-300 ease-out transform translate-x-0">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2d2d2d] mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="text-yellow-500 animate-pulse" size={18} />
                <div>
                  <h2 className="text-[12px] font-black uppercase tracking-wider text-yellow-500">Gold & Buff Shop</h2>
                  <span className="text-[10px] text-gray-500">Available: {stats.points.toLocaleString()} pts</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEditMode(!isEditMode)} 
                  className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all ${isEditMode ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'bg-[#222] border border-[#333] text-gray-400 hover:text-white'}`}
                >
                  {isEditMode ? 'Exit Edit' : 'Edit Shop'}
                </button>
                <button onClick={() => setIsShopOpen(false)} className="p-1 text-gray-500 hover:text-white hover:bg-[#222] rounded transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Shop Items */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
              {isEditMode && (
                <button 
                  onClick={() => setNewItemModal(true)} 
                  className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600/10 border border-dashed border-purple-500/30 text-purple-400 hover:text-white hover:bg-purple-600/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  <Plus size={14} /> Add Custom Shop Item
                </button>
              )}

              {shopItems.length === 0 ? (
                <div className="text-center py-16 text-gray-500 border border-dashed border-[#2d2d2d] rounded-xl text-sm">
                  The shop is currently empty.
                </div>
              ) : (
                <div className="space-y-3">
                  {shopItems.map(item => {
                    const icon = 
                      item.type === 'buff' ? <Shield size={20} className="text-blue-400" /> :
                      item.type === 'timer' ? <Timer size={20} className="text-green-400" /> :
                      item.type === 'note' ? <Sparkles size={20} className="text-purple-400" /> :
                      <Clock size={20} className="text-orange-400" />;

                    return (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-[#111] border border-[#2d2d2d] rounded-xl hover:border-purple-500/30 transition-all group relative">
                        <div className="p-3 bg-[#1a1a1a] rounded-lg group-hover:scale-105 transition-transform shrink-0">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-gray-200 truncate">{item.name}</h3>
                            <span className="text-[8px] font-black uppercase tracking-wider text-gray-600 bg-[#1a1a1a] px-1 py-0.2 rounded border border-[#2d2d2d]">{item.type}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                          {item.durationHours && item.durationHours > 0 ? (
                            <span className="text-[9px] text-blue-500 font-bold block mt-1">Duration: {item.durationHours} hours</span>
                          ) : null}
                        </div>
                        
                        {isEditMode ? (
                          <div className="flex gap-1 shrink-0 z-10">
                            <button 
                              onClick={() => setEditingItem(item)} 
                              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                              title="Edit Item"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteShopItem(item.id)} 
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleBuyItem(item)}
                            className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-purple-500/10"
                          >
                            {item.cost} <span className="opacity-70 text-[10px]">pts</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Forms & Dialogs */}
      {inputDialog && (
        <InputDialog
          isOpen={inputDialog.isOpen}
          title={inputDialog.title}
          message={inputDialog.message}
          type={inputDialog.type}
          onClose={() => setInputDialog(null)}
          onSubmit={inputDialog.onSubmit}
        />
      )}

      <ShopItemFormModal 
        isOpen={newItemModal} 
        onClose={() => setNewItemModal(false)} 
        onSubmit={handleCreateShopItem} 
      />

      <ShopItemFormModal 
        isOpen={!!editingItem} 
        onClose={() => setEditingItem(null)} 
        onSubmit={handleUpdateShopItem}
        initialItem={editingItem}
      />
    </div>
  );
}

function ShopItemFormModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialItem 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSubmit: (item: Omit<ShopItem, 'id'>) => void, 
  initialItem?: ShopItem | null 
}) {
  const [name, setName] = useState(initialItem?.name || '');
  const [description, setDescription] = useState(initialItem?.description || '');
  const [cost, setCost] = useState(initialItem?.cost || 100);
  const [type, setType] = useState<ShopItem['type']>(initialItem?.type || 'buff');
  const [durationHours, setDurationHours] = useState(initialItem?.durationHours || 24);

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name);
      setDescription(initialItem.description);
      setCost(initialItem.cost);
      setType(initialItem.type);
      setDurationHours(initialItem.durationHours || 24);
    } else {
      setName('');
      setDescription('');
      setCost(100);
      setType('buff');
      setDurationHours(24);
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialItem ? "Edit Shop Item" : "Create Shop Item"}>
      <div className="space-y-4 p-1 text-left">
        <div>
          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Item Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g. Health Potion" 
            className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50" 
          />
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Description</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="What does this item do?" 
            rows={3}
            className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 resize-none" 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Cost (Points)</label>
            <input 
              type="number" 
              value={cost} 
              onChange={(e) => setCost(Math.max(1, parseInt(e.target.value) || 0))} 
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50" 
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Item Type</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as ShopItem['type'])} 
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="buff">Buff (Temporal)</option>
              <option value="timer">Timer (Focus)</option>
              <option value="note">Note (Task Attachment)</option>
              <option value="instant">Instant (Consumable)</option>
            </select>
          </div>
        </div>

        {type === 'buff' && (
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Buff Duration (Hours)</label>
            <input 
              type="number" 
              value={durationHours} 
              onChange={(e) => setDurationHours(Math.max(1, parseFloat(e.target.value) || 0))} 
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50" 
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-[#222] mt-4">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-[#222] text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (!name.trim()) return;
              onSubmit({ name, description, cost, type, durationHours });
            }} 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Sparkles size={14} /> {initialItem ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
