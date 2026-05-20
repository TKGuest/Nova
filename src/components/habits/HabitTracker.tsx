'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, orderBy, writeBatch, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { Plus, Trash2, Table as TableIcon, LayoutGrid, Check, Type, Hash, Calendar as CalendarIcon, Settings2, GripVertical, MoreVertical, Copy, Edit3, ChevronDown, ChevronRight, Edit, X, ChevronLeft, StickyNote, Activity, Type as TypeIcon, Settings, Image as ImageIcon, Gamepad2, ShoppingBag, Shield, Timer, Sparkles, Clock, Edit2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Checkbox } from '@/components/ui/Checkbox';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modals';
import { PageModel, HabitStats, ShopItem, InventoryItem } from '@/types';
import { useNotification } from '@/context/NotificationContext';
import { format, isSameDay, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, parseISO, addDays, isAfter, isSameWeek, getYear, getMonth, addMonths, subMonths, setYear, setMonth, isSameMonth } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LexoRank } from 'lexorank';
import { CoverImage } from '@/components/ui/CoverImage';
import { GamificationDashboard } from './GamificationDashboard';

type PropertyType = 'habit' | 'counter' | 'notes' | 'toggle_list';
type TextSize = 'small' | 'medium' | 'large';

interface MasterTask {
  id: string;
  name: string;
  sortOrder: string;
  type: PropertyType;
  parentId?: string | null;
  
  // Gamification & Sub-tasks
  pointsValue?: number;
  isBadHabit?: boolean;
  subTasks?: { id: string; title: string; points?: number }[];
  autoTickMode?: 'any' | 'all' | 'manual';
  rewardMode?: 'main_only' | 'subtasks_separately';
  subTaskPoints?: number;
  bonusPoints?: number;
}

interface PageRecord {
  id: string;
  date: string;
  data: Record<string, boolean>;
  notes?: string;
  allHabitsBonusAwarded?: boolean;
  coverImage?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
}

export function HabitTracker({ pageId, isPeek = false }: { pageId: string, isPeek?: boolean }) {
  const { user } = useAuth();
  const { sidePeekRecordId, setSidePeekRecordId, setSidePeekPageId } = useWorkspace();
  const [masterTasks, setMasterTasks] = useState<MasterTask[]>([]);
  const [records, setRecords] = useState<PageRecord[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const [counterFormat, setCounterFormat] = useState<'fraction' | 'percent'>('fraction');
  const [textSize, setTextSize] = useState<TextSize>('small');
  const [textTruncateMode, setTextTruncateMode] = useState<'wrap' | 'truncate'>('wrap');
  const [pageMeta, setPageMeta] = useState<PageModel | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<{ initialDate?: Date } | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDefaultCoverModalOpen, setIsDefaultCoverModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, taskId: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, label: string } | null>(null);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [gamificationStats, setGamificationStats] = useState<HabitStats | null>(null);
  
  // Shop & Inventory States
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [newItemModal, setNewItemModal] = useState(false);
  const { showToast, confirm: customConfirm } = useNotification();


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Lock body scroll when modals/drawers are open on mobile
  useEffect(() => {
    const isModalOpen = !!sidePeekRecordId || isShopOpen || isPropertyModalOpen || isDefaultCoverModalOpen || isDatePickerOpen !== null || newItemModal || !!editingItem;
    const scrollContainer = document.getElementById('main-scroll-container');
    
    if (isModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (scrollContainer) {
        scrollContainer.style.overflowY = 'hidden';
      }
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (scrollContainer) {
        scrollContainer.style.overflowY = 'auto';
      }
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (scrollContainer) {
        scrollContainer.style.overflowY = 'auto';
      }
    };
  }, [sidePeekRecordId, isShopOpen, isPropertyModalOpen, isDefaultCoverModalOpen, isDatePickerOpen, newItemModal, editingItem]);


  useEffect(() => {
    const savedSize = localStorage.getItem(`habits_text_size_${pageId}`);
    if (savedSize) setTextSize(savedSize as TextSize);
    const savedFormat = localStorage.getItem(`habits_counter_format_${pageId}`);
    if (savedFormat) setCounterFormat(savedFormat as 'fraction' | 'percent');
    const savedTruncate = localStorage.getItem(`habits_truncate_mode_${pageId}`);
    if (savedTruncate) setTextTruncateMode(savedTruncate as 'wrap' | 'truncate');
    setIsLoaded(true);
  }, [pageId]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(`habits_text_size_${pageId}`, textSize);
  }, [textSize, pageId, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(`habits_counter_format_${pageId}`, counterFormat);
  }, [counterFormat, pageId, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(`habits_truncate_mode_${pageId}`, textTruncateMode);
  }, [textTruncateMode, pageId, isLoaded]);

  useEffect(() => {
    if (!user || !pageId) return;
    const qMaster = query(collection(db, 'users', user.uid, 'pages', pageId, 'master_tasks'), orderBy('sortOrder', 'asc'));
    const unsubMaster = onSnapshot(qMaster, (snapshot) => {
      setMasterTasks(snapshot.docs.map(d => ({ type: 'habit', ...d.data(), id: d.id } as MasterTask)));
    });
    const qRecords = query(collection(db, 'users', user.uid, 'pages', pageId, 'records'), orderBy('date', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PageRecord)));
    });
    const unsubPage = onSnapshot(doc(db, 'users', user.uid, 'pages', pageId), (snapshot) => {
      if (snapshot.exists()) setPageMeta({ id: snapshot.id, ...snapshot.data() } as PageModel);
    });
    const unsubStats = onSnapshot(doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats'), (snapshot) => {
      if (snapshot.exists()) setGamificationStats(snapshot.data() as HabitStats);
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
    const shopRef = collection(db, 'users', user.uid, 'pages', pageId, 'shop_items');
    const unsubShop = onSnapshot(shopRef, async (snapshot) => {
      if (snapshot.empty) {
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
    const handleOpenManager = () => setIsPropertyModalOpen(true);
    window.addEventListener('open-task-manager', handleOpenManager);
    const handleClick = () => { 
      setContextMenu(null);
      setIsSettingsOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => { 
      unsubMaster(); unsubRecords(); unsubPage(); unsubStats(); unsubInv(); unsubShop();
      window.removeEventListener('open-task-manager', handleOpenManager);
      window.removeEventListener('click', handleClick);
    };
  }, [user, pageId]);

  // Disable browser scroll-wheel changing of active number inputs globally
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement && (document.activeElement as HTMLInputElement).type === 'number') {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  // Auto-create today's record and process daily logic
  useEffect(() => {
    if (!user || !pageId) return;

    const processGamificationDaily = async (dateStr: string) => {
      const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
      const statsSnap = await getDoc(statsRef);
      if (!statsSnap.exists()) return;
      const stats = statsSnap.data() as any;
      const today = parseISO(dateStr);
      let updates: any = {};

      const now = new Date();
      const activeBuffs = (stats.equippedBuffs || []).filter((b: any) => new Date(b.expiresAt) > now);
      const hasHolidayPass = activeBuffs.some((b: any) => b.name.toLowerCase().includes('holiday pass'));
      const hasStreakInsurance = activeBuffs.some((b: any) => b.name.toLowerCase().includes('streak insurance'));
      
      // Decay points if it's been more than a day
      if (stats.lastDecayDate) {
        const lastDecay = parseISO(stats.lastDecayDate);
        if (isAfter(startOfDay(today), startOfDay(lastDecay))) {
          const diffDays = Math.floor((today.getTime() - lastDecay.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            // Clean expired buffs from stats on day transition
            updates.equippedBuffs = activeBuffs;

            // If Holiday Pass is active, skip all decays and resets completely!
            if (hasHolidayPass) {
              updates.lastDecayDate = dateStr;
              await updateDoc(statsRef, updates);
              return;
            }

            updates.points = stats.points - (diffDays * 5); // 5 points decay per day
            updates.lastDecayDate = dateStr;
            
            if (updates.points < 0) updates.debt = true;
            
            const taskStreaks = { ...(stats.taskStreaks || {}) };
            let insuranceConsumed = false;
            
            if (diffDays > 1) {
              // Missed multiple days, reset all streaks
              Object.keys(taskStreaks).forEach(taskId => {
                taskStreaks[taskId] = {
                  streak: 0,
                  multiplier: 1.0,
                  lastCompletedDate: taskStreaks[taskId]?.lastCompletedDate || ''
                };
              });
            } else {
              // Exactly 1 day passed. Check if each task was completed yesterday.
              const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
              const yesterdayRecRef = doc(db, 'users', user.uid, 'pages', pageId, 'records', `rec_${yesterdayStr}`);
              const yesterdayRecSnap = await getDoc(yesterdayRecRef);
              const yesterdayData = yesterdayRecSnap.exists() ? (yesterdayRecSnap.data()?.data || {}) : {};

              Object.keys(taskStreaks).forEach(taskId => {
                // If not completed yesterday, check Streak Insurance
                if (!yesterdayData[taskId]) {
                  if (hasStreakInsurance) {
                    insuranceConsumed = true; // Streak Insurance protects it!
                  } else {
                    taskStreaks[taskId] = {
                      streak: 0,
                      multiplier: 1.0,
                      lastCompletedDate: taskStreaks[taskId]?.lastCompletedDate || ''
                    };
                  }
                }
              });
            }
            updates.taskStreaks = taskStreaks;

            if (insuranceConsumed) {
              // Consume Streak Insurance (remove it from equipped buffs)
              updates.equippedBuffs = activeBuffs.filter((b: any) => !b.name.toLowerCase().includes('streak insurance'));
            }
          }
        }
      } else {
        updates.lastDecayDate = dateStr;
      }
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(statsRef, updates);
      }
    };

    const createTodayRecord = async () => {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const recordId = `rec_${dateStr}`;
      const recordRef = doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId);
      const snap = await getDoc(recordRef);
      if (!snap.exists()) {
        const data: Record<string, unknown> = { id: recordId, date: dateStr, data: {} };
        if (pageMeta?.defaultRecordCover) data.coverImage = pageMeta.defaultRecordCover;
        await setDoc(recordRef, data);
        
        await processGamificationDaily(dateStr);
      }
    };

    createTodayRecord();
    const interval = setInterval(() => {
      createTodayRecord();
    }, 60000); // Check every minute if day has rolled over

    return () => clearInterval(interval);
  }, [user, pageId, pageMeta]);

  const weeklyGroups = useMemo(() => {
    const groups: Record<string, { label: string, items: PageRecord[] }> = {};
    const today = startOfDay(new Date());
    records.forEach(r => {
      const d = parseISO(r.date);
      const weekKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!groups[weekKey]) {
        const start = startOfWeek(d, { weekStartsOn: 1 });
        groups[weekKey] = { label: `${format(start, 'MMM d')} \u2013 ${format(addDays(start, 6), 'MMM d yyyy')}`, items: [] };
      }
      groups[weekKey].items.push(r);
    });
    const currentWeekKey = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (!groups[currentWeekKey]) {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      groups[currentWeekKey] = { label: `${format(start, 'MMM d')} \u2013 ${format(addDays(start, 6), 'MMM d yyyy')}`, items: [] };
    }
    Object.values(groups).forEach(g => g.items.sort((a, b) => a.date.localeCompare(b.date)));
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  const safeParse = (s: string | null | undefined) => {
    try { return s ? LexoRank.parse(s) : LexoRank.middle(); } catch { return LexoRank.middle(); }
  };

  const addMasterTask = async (type: PropertyType = 'habit') => {
    if (!user) return;
    const id = `mtask_${Date.now()}`;
    const sortOrder = masterTasks.length > 0 ? safeParse(masterTasks[masterTasks.length - 1].sortOrder).genNext().toString() : LexoRank.middle().toString();
    await setDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', id), { id, name: type === 'habit' ? 'New Task' : type === 'notes' ? 'Quick Notes' : 'Progress Counter', sortOrder, type });
  };

  const deleteMasterTask = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', id));
  };

  const deleteRecord = async (id: string) => {
    if (!user) return;
    setConfirmDelete(null);
    await deleteDoc(doc(db, 'users', user.uid, 'pages', pageId, 'records', id));
  };

  const duplicateMasterTask = async (id: string) => {
    if (!user) return;
    const task = masterTasks.find(t => t.id === id);
    if (!task) return;
    const newId = `mtask_${Date.now()}`;
    const sortOrder = safeParse(task.sortOrder).genNext().toString();
    await setDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', newId), { ...task, id: newId, name: `${task.name} (Copy)`, sortOrder });
  };

  const evaluateAllHabitsBonus = (
    recordId: string,
    recordData: Record<string, boolean>,
    currentPoints: number,
    stats: any,
    todayStr: string
  ) => {
    const activeHabits = masterTasks.filter(t => t.type === 'habit');
    if (activeHabits.length === 0) return { points: currentPoints, bonusAwarded: false };
    
    const allCompleted = activeHabits.every(t => !!recordData[t.id]);
    const bonusPointsAmount = stats.allHabitsBonus ?? 50;
    
    const record = records.find(r => r.id === recordId);
    const wasBonusAwarded = !!record?.allHabitsBonusAwarded;
    
    let finalPoints = currentPoints;
    let nextBonusAwarded = wasBonusAwarded;
    
    if (allCompleted && !wasBonusAwarded) {
      finalPoints += bonusPointsAmount;
      nextBonusAwarded = true;
    } else if (!allCompleted && wasBonusAwarded) {
      finalPoints -= bonusPointsAmount;
      nextBonusAwarded = false;
    }
    
    return { points: finalPoints, bonusAwarded: nextBonusAwarded };
  };

  const toggleCompletion = async (recordId: string, taskId: string, current: boolean) => {
    if (!user) return;
    const isCompleted = !current;
    
    const recordRef = doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) return;
    
    const record = recordSnap.data();
    const recordData = record?.data || {};
    const nextRecordData = { ...recordData, [taskId]: isCompleted };
    
    // Gamification Hook
    try {
      const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
      const statsSnap = await getDoc(statsRef);
      if (statsSnap.exists()) {
        const stats = statsSnap.data() as any;
        const task = masterTasks.find(t => t.id === taskId);
        
        // Handle streak calculation for the specific task
        const taskStreaks = stats.taskStreaks || {};
        const currentTaskStreak = taskStreaks[taskId] || { streak: 0, multiplier: 1.0, lastCompletedDate: '' };
        
        let newStreak = currentTaskStreak.streak;
        let newMultiplier = currentTaskStreak.multiplier;
        let newLastCompletedDate = currentTaskStreak.lastCompletedDate || '';

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        if (isCompleted) {
          if (newLastCompletedDate === yesterdayStr) {
            newStreak += 1;
            newMultiplier = Math.min(1.5, newMultiplier + 0.01);
          } else if (newLastCompletedDate === todayStr) {
            // Already completed today, do not increment again
          } else {
            newStreak = 1;
            newMultiplier = 1.01;
          }
          newLastCompletedDate = todayStr;
        } else {
          if (newLastCompletedDate === todayStr) {
            newStreak = Math.max(0, newStreak - 1);
            newMultiplier = Math.max(1.0, newMultiplier - 0.01);
            newLastCompletedDate = yesterdayStr;
          }
        }

        taskStreaks[taskId] = {
          streak: newStreak,
          multiplier: parseFloat(newMultiplier.toFixed(2)),
          lastCompletedDate: newLastCompletedDate
        };
        
        // Base points: either custom defined on task, or default 10.
        const basePoints = task?.pointsValue || 10; 
        const multiplier = newMultiplier || 1.0;
        const pointsChange = Math.round(basePoints * multiplier);
        
        let newPoints = stats.points;
        let pointsEarnedToday = stats.pointsEarnedToday || 0;
        
        if (stats.lastPointGainDate !== todayStr) {
          pointsEarnedToday = 0; // Reset cap for new day
        }
        
        const DAILY_CAP = 200; // Inflation control cap
        let actualGain = pointsChange;
        
        if (isCompleted) {
          if (pointsEarnedToday + actualGain > DAILY_CAP) {
            actualGain = Math.max(0, DAILY_CAP - pointsEarnedToday);
          }
          newPoints += actualGain;
          pointsEarnedToday += actualGain;
        } else {
          newPoints = stats.points - pointsChange; // Debt mode allows negative
          pointsEarnedToday = Math.max(0, pointsEarnedToday - pointsChange);
        }
        
        // Check Completed All Habits Daily Bonus
        const { points: finalPoints, bonusAwarded } = evaluateAllHabitsBonus(recordId, nextRecordData, newPoints, stats, todayStr);
        
        await updateDoc(recordRef, { 
          data: nextRecordData,
          allHabitsBonusAwarded: bonusAwarded
        });
        
        await updateDoc(statsRef, { 
          points: finalPoints,
          pointsEarnedToday,
          lastPointGainDate: todayStr,
          debt: finalPoints < 0,
          taskStreaks
        });
      }
    } catch (err) {
      console.warn("Gamification error:", err);
    }
  };

  const toggleSubTask = async (recordId: string, taskId: string, subId: string, current: boolean) => {
    if (!user) return;
    
    const isCompleted = !current;
    const recordRef = doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) return;
    
    const record = recordSnap.data();
    const recordData = record?.data || {};
    const subKey = `${taskId}_${subId}`;
    
    // 1. Update the record sub-task completion value
    const nextRecordData = { ...recordData, [subKey]: isCompleted };
    
    // 2. Fetch current stats
    const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    const statsSnap = await getDoc(statsRef);
    if (!statsSnap.exists()) return;
    const stats = statsSnap.data() as any;
    
    const task = masterTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const taskStreaks = stats.taskStreaks || {};
    const currentTaskStreak = taskStreaks[taskId] || { streak: 0, multiplier: 1.0, lastCompletedDate: '' };
    const multiplier = currentTaskStreak.multiplier || 1.0;
    
    let pointsGained = 0;
    
    // A. Reward Mode points for this sub-task
    if (task.rewardMode === 'subtasks_separately') {
      const subTaskObj = task.subTasks?.find(s => s.id === subId);
      const subTaskBase = subTaskObj?.points ?? 2;
      const subTaskPointsChange = Math.round(subTaskBase * multiplier);
      pointsGained += isCompleted ? subTaskPointsChange : -subTaskPointsChange;
    }
    
    // B. 100% Sub-tasks Completed Bonus
    if (task.subTasks && task.subTasks.length > 0 && task.rewardMode !== 'subtasks_separately') {
      const totalSubs = task.subTasks.length;
      const prevCompletedCount = task.subTasks.filter(s => !!recordData[`${taskId}_${s.id}`]).length;
      const nextCompletedCount = task.subTasks.filter(s => !!nextRecordData[`${taskId}_${s.id}`]).length;
      
      const wasAllComplete = prevCompletedCount === totalSubs;
      const isAllComplete = nextCompletedCount === totalSubs;
      
      if (isAllComplete && !wasAllComplete) {
        const bonusBase = task.bonusPoints ?? 5;
        pointsGained += Math.round(bonusBase * multiplier);
      } else if (!isAllComplete && wasAllComplete) {
        const bonusBase = task.bonusPoints ?? 5;
        pointsGained -= Math.round(bonusBase * multiplier);
      }
      
      // C. Auto-Tick Main Task
      if (task.autoTickMode === 'any') {
        const nextShouldBeComplete = nextCompletedCount > 0;
        const currentMainComplete = !!recordData[taskId];
        
        if (nextShouldBeComplete !== currentMainComplete) {
          nextRecordData[taskId] = nextShouldBeComplete;
          const basePoints = task.pointsValue || 10;
          const mainPointsChange = Math.round(basePoints * multiplier);
          pointsGained += nextShouldBeComplete ? mainPointsChange : -mainPointsChange;
          
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
          let newStreak = currentTaskStreak.streak;
          let newMultiplier = currentTaskStreak.multiplier;
          let newLastCompletedDate = currentTaskStreak.lastCompletedDate || '';
          
          if (nextShouldBeComplete) {
            if (newLastCompletedDate === yesterdayStr) {
              newStreak += 1;
              newMultiplier = Math.min(1.5, newMultiplier + 0.01);
            } else if (newLastCompletedDate === todayStr) {
              // Already completed today
            } else {
              newStreak = 1;
              newMultiplier = 1.01;
            }
            newLastCompletedDate = todayStr;
          } else {
            if (newLastCompletedDate === todayStr) {
              newStreak = Math.max(0, newStreak - 1);
              newMultiplier = Math.max(1.0, newMultiplier - 0.01);
              newLastCompletedDate = yesterdayStr;
            }
          }
          taskStreaks[taskId] = {
            streak: newStreak,
            multiplier: parseFloat(newMultiplier.toFixed(2)),
            lastCompletedDate: newLastCompletedDate
          };
        }
      } else if (task.autoTickMode === 'all') {
        const nextShouldBeComplete = nextCompletedCount === totalSubs;
        const currentMainComplete = !!recordData[taskId];
        
        if (nextShouldBeComplete !== currentMainComplete) {
          nextRecordData[taskId] = nextShouldBeComplete;
          const basePoints = task.pointsValue || 10;
          const mainPointsChange = Math.round(basePoints * multiplier);
          pointsGained += nextShouldBeComplete ? mainPointsChange : -mainPointsChange;
          
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
          let newStreak = currentTaskStreak.streak;
          let newMultiplier = currentTaskStreak.multiplier;
          let newLastCompletedDate = currentTaskStreak.lastCompletedDate || '';
          
          if (nextShouldBeComplete) {
            if (newLastCompletedDate === yesterdayStr) {
              newStreak += 1;
              newMultiplier = Math.min(1.5, newMultiplier + 0.01);
            } else if (newLastCompletedDate === todayStr) {
              // Already completed today
            } else {
              newStreak = 1;
              newMultiplier = 1.01;
            }
            newLastCompletedDate = todayStr;
          } else {
            if (newLastCompletedDate === todayStr) {
              newStreak = Math.max(0, newStreak - 1);
              newMultiplier = Math.max(1.0, newMultiplier - 0.01);
              newLastCompletedDate = yesterdayStr;
            }
          }
          taskStreaks[taskId] = {
            streak: newStreak,
            multiplier: parseFloat(newMultiplier.toFixed(2)),
            lastCompletedDate: newLastCompletedDate
          };
        }
      }
    }
    
    // 3. Write points update with DAILY CAP check
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let newPoints = stats.points;
    let pointsEarnedToday = stats.pointsEarnedToday || 0;
    if (stats.lastPointGainDate !== todayStr) {
      pointsEarnedToday = 0;
    }
    const DAILY_CAP = 200;
    let actualGain = pointsGained;
    if (pointsGained > 0) {
      if (pointsEarnedToday + pointsGained > DAILY_CAP) {
        actualGain = Math.max(0, DAILY_CAP - pointsEarnedToday);
      }
    }
    newPoints += actualGain;
    pointsEarnedToday = Math.max(0, pointsEarnedToday + actualGain);
    
    // Check Completed All Habits Daily Bonus
    const { points: finalPoints, bonusAwarded } = evaluateAllHabitsBonus(recordId, nextRecordData, newPoints, stats, todayStr);
    
    // Save all updates to Firestore
    await updateDoc(recordRef, { 
      data: nextRecordData,
      allHabitsBonusAwarded: bonusAwarded
    });
    
    await updateDoc(statsRef, {
      points: finalPoints,
      pointsEarnedToday,
      lastPointGainDate: todayStr,
      debt: finalPoints < 0,
      taskStreaks
    });
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !user) return;
    const activeTaskId = active.id.toString().split('::')[1];
    const overTaskId = over.id.toString().split('::')[1];
    
    const activeTask = masterTasks.find(t => t.id === activeTaskId);
    const overTask = masterTasks.find(t => t.id === overTaskId);
    if (!activeTask || !overTask) return;

    // Optional: Only allow reordering within the same parent boundary in the dashboard drag
    if (activeTask.parentId !== overTask.parentId) return;

    const listToReorder = masterTasks.filter(t => t.parentId === activeTask.parentId);
    const oldIndex = listToReorder.findIndex(t => t.id === activeTaskId);
    const newIndex = listToReorder.findIndex(t => t.id === overTaskId);
    const newOrder = arrayMove(listToReorder, oldIndex, newIndex);
    
    let sortOrder;
    if (newIndex === 0) sortOrder = safeParse(newOrder[1]?.sortOrder).genPrev().toString();
    else if (newIndex === newOrder.length - 1) sortOrder = safeParse(newOrder[newIndex-1]?.sortOrder).genNext().toString();
    else sortOrder = safeParse(newOrder[newIndex-1]?.sortOrder).between(safeParse(newOrder[newIndex+1]?.sortOrder)).toString();
    
    await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', activeTaskId), { sortOrder });
  };

  const getTextClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[15px] md:text-[16px]';
      case 'large': return 'text-[18px] md:text-[20px]';
      default: return 'text-[12px] md:text-[14px]';
    }
  };

  const getLabelClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[11px] md:text-[12px]';
      case 'large': return 'text-[13px] md:text-[14px]';
      default: return 'text-[9.5px] md:text-[11px]';
    }
  };

  const getCheckboxScale = () => {
    switch (textSize) {
      case 'medium': return 'scale-[1.0] md:scale-[1.1]';
      case 'large': return 'scale-[1.15] md:scale-[1.25]';
      default: return 'scale-[0.85] md:scale-[1.0]';
    }
  };

  const getDateHeaderClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[10px] md:text-[11px]';
      case 'large': return 'text-[12px] md:text-[13px]';
      default: return 'text-[8px] md:text-[9.5px]';
    }
  };

  const getDateValClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[13px] md:text-[14px]';
      case 'large': return 'text-[16px] md:text-[17px]';
      default: return 'text-[10.5px] md:text-[12px]';
    }
  };

  const getSectionTitleClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[9px] md:text-[10px]';
      case 'large': return 'text-[11px] md:text-[12px]';
      default: return 'text-[7px] md:text-[8.5px]';
    }
  };

  const getSectionContentClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[11px] md:text-[12px]';
      case 'large': return 'text-[13px] md:text-[14px]';
      default: return 'text-[9px] md:text-[10.5px]';
    }
  };

  const handleBuyItem = async (item: ShopItem) => {
    if (!user || !gamificationStats) return;
    if (gamificationStats.debt || gamificationStats.points < item.cost) {
      showToast('Not enough points or in Debt Mode!', 'error');
      return;
    }

    customConfirm({
      title: `Purchase ${item.name}?`,
      message: `This will cost ${item.cost} points.`,
      confirmLabel: 'Buy',
      onConfirm: async () => {
        const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
        await updateDoc(statsRef, { points: gamificationStats.points - item.cost });

        const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
        const existingItem = inventory.find(i => i.id === item.id);
        
        let newItems = [...inventory];
        if (existingItem) {
          newItems = newItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1, costPurchased: item.cost, durationHours: item.durationHours || i.durationHours } : i);
        } else {
          newItems.push({
            id: item.id,
            name: item.name,
            type: item.type,
            quantity: 1,
            costPurchased: item.cost,
            durationHours: item.durationHours || 0
          });
        }
        
        await updateDoc(invRef, { items: newItems });
        showToast(`${item.name} purchased!`, 'success');
      }
    });
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
    const item = shopItems.find(i => i.id === itemId);
    if (item) {
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes('streak insurance') || nameLower.includes('holiday pass')) {
        showToast('System items cannot be deleted!', 'error');
        return;
      }
    }
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={`w-full flex flex-col bg-[#0a0a0a] ${isPeek ? 'flex-1 min-h-0 overflow-hidden py-4 px-6' : 'py-4 px-4 md:px-10'}`}>
        {/* Header - Hidden in focused peek mode to save space */}
        {!(isPeek && sidePeekRecordId) && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsDatePickerOpen({})} className="flex items-center gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2.5 bg-[#2383e2] text-white rounded-md text-[9px] md:text-[11px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg shadow-blue-500/10 shrink-0"><Plus size={14}/> New</button>
            <button 
              onClick={() => setIsGamificationOpen(!isGamificationOpen)} 
              className={`flex items-center gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2.5 rounded-md text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${isGamificationOpen ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-purple-400 border-purple-900/30'}`}
            >
              <Gamepad2 size={14}/> Gamify
            </button>
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
                className={`flex items-center gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2.5 rounded-md text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${isSettingsOpen ? 'bg-[#222] text-white' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-white'}`}
              >
                <Settings size={14}/> Settings
              </button>
              {isSettingsOpen && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-2 z-[100] w-64 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-2xl p-4 space-y-6 text-left">
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Dashboard Tools</span>
                    <button onClick={() => { setIsPropertyModalOpen(true); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#111] border border-[#2d2d2d] text-gray-400 rounded-md text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-[#3d3d3d] transition-all cursor-pointer"><Settings2 size={16}/> Manage Properties</button>
                    <button onClick={() => { setIsDefaultCoverModalOpen(true); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#111] border border-[#2d2d2d] text-gray-400 rounded-md text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-[#3d3d3d] transition-all cursor-pointer"><ImageIcon size={16}/> Default Card Cover</button>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Counter Format</span>
                    <div className="flex bg-[#111] rounded-md p-1 border border-[#1a1a1a]">
                      <button onClick={() => setCounterFormat('fraction')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${counterFormat === 'fraction' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>Fraction</button>
                      <button onClick={() => setCounterFormat('percent')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${counterFormat === 'percent' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>Percent</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Text Scaling</span>
                    <div className="flex bg-[#111] rounded-md p-1 border border-[#1a1a1a]">
                      <button onClick={() => setTextSize('small')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all cursor-pointer ${textSize === 'small' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>A</button>
                      <button onClick={() => setTextSize('medium')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all cursor-pointer ${textSize === 'medium' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>A+</button>
                      <button onClick={() => setTextSize('large')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all cursor-pointer ${textSize === 'large' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>A++</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Long Tasks Display</span>
                    <div className="flex bg-[#111] rounded-md p-1 border border-[#1a1a1a]">
                      <button onClick={() => setTextTruncateMode('wrap')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${textTruncateMode === 'wrap' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>Wrap</button>
                      <button onClick={() => setTextTruncateMode('truncate')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${textTruncateMode === 'truncate' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>Truncate</button>
                    </div>
                  </div>
                  <div className="space-y-3 border-t border-[#2d2d2d]/50 pt-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">All Habits Daily Bonus</span>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between bg-[#111] border border-[#2d2d2d] rounded px-3 py-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Bonus Points</span>
                        <input 
                          type="number" 
                          className="bg-transparent text-right outline-none text-white text-[11px] font-medium w-16"
                          value={gamificationStats?.allHabitsBonus ?? 50}
                          onChange={async (e) => {
                            if (!user) return;
                            const nextVal = parseInt(e.target.value) || 0;
                            const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
                            await updateDoc(statsRef, { allHabitsBonus: nextVal });
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </div>
                      <span className="text-[9px] text-gray-600 leading-normal block">Earned when all daily main habits are successfully completed.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex bg-[#111] rounded-md p-0.5 md:p-1 border border-[#1a1a1a] shrink-0">
            <button onClick={() => setViewMode('table')} className={`px-2 md:px-3.5 py-1.5 md:py-2 rounded flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${viewMode === 'table' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}><TableIcon size={12}/> Table</button>
            <button onClick={() => setViewMode('card')} className={`px-2 md:px-3.5 py-1.5 md:py-2 rounded flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${viewMode === 'card' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}><LayoutGrid size={12}/> Card</button>
          </div>
        </div>
        )}

        <div className={`flex-1 ${isPeek ? 'overflow-auto' : ''} custom-scrollbar overscroll-contain touch-pan-y`}>
          {isGamificationOpen ? (
            <div className="p-4 bg-[#111] rounded-xl border border-purple-900/30 min-h-[400px]">
               <GamificationDashboard pageId={pageId} onOpenShop={() => setIsShopOpen(true)} />
            </div>
          ) : isPeek && sidePeekRecordId ? (
            <div className="flex flex-col h-full max-w-2xl mx-auto py-2">
              {records.filter(r => r.id === sidePeekRecordId).map(record => {
                const dateObj = parseISO(record.date);
                const habits = masterTasks.filter(t => t.type === 'habit');
                const completedCount = habits.filter(h => !!record.data?.[h.id]).length;
                const totalCount = habits.length;
                const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                return (
                  <div key={record.id} className="flex-1 flex flex-col space-y-6">
                    <CoverImage 
                      key={`${record.id}-${record.coverImage?.url || 'no-cover'}`}
                      pageId={pageId} 
                      recordId={record.id} 
                      coverImage={record.coverImage} 
                    />
                    <div className="flex flex-col gap-1 border-b border-[#1a1a1a] pb-6 mb-2 text-left">
                      <span className={`font-black uppercase tracking-[0.3em] ${getDateHeaderClasses()} ${isSameDay(dateObj, new Date()) ? 'text-blue-500' : 'text-gray-600'}`}>
                        {isSameDay(dateObj, new Date()) ? '@Today' : isSameDay(dateObj, subDays(new Date(), 1)) ? '@Yesterday' : `@${format(dateObj, 'EEEE')}`}
                      </span>
                      <h2 className={`font-bold text-white tracking-tight ${textSize === 'large' ? 'text-3xl' : textSize === 'medium' ? 'text-2xl' : 'text-xl'}`}>{format(dateObj, 'MMMM d, yyyy')}</h2>
                    </div>

                    <div className="flex-1 space-y-1">
                      <h3 className={`font-black uppercase text-gray-700 tracking-widest mb-4 px-1 ${getSectionTitleClasses()}`}>Daily Habits</h3>
                      <SortableContext items={masterTasks.map(t => `${record.id}::${t.id}`)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-0.5">
                          {masterTasks.filter(t => !t.parentId && (t.type === 'habit' || t.type === 'toggle_list')).map(task => (
                              <SortableMasterItem 
                                key={task.id} 
                                id={`${record.id}::${task.id}`} 
                                task={task} 
                                allTasks={masterTasks}
                                completed={!!record.data?.[task.id]} 
                                recordData={record.data || {}}
                                isPeek={true}
                                streak={gamificationStats?.taskStreaks?.[task.id]?.streak || 0}
                                onToggle={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} 
                                onToggleSubTask={(subId: string, current: boolean) => toggleSubTask(record.id, task.id, subId, current)}
                                onContextMenu={(e: any) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, taskId: task.id }); }} 
                                isEditing={editingTaskId === task.id} 
                                onRename={(newName: string) => { updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', task.id), { name: newName }); setEditingTaskId(null); }} 
                                textSizeClass={textSize === 'large' ? 'text-[19px]' : textSize === 'medium' ? 'text-[17px]' : 'text-[15px]'} 
                                checkboxScale="scale-[1.15]" 
                                textTruncateMode={textTruncateMode}
                              />
                          ))}
                        </div>
                      </SortableContext>
                      
                      <button onClick={() => addMasterTask()} className="flex items-center gap-2 px-2 py-3 text-gray-700 hover:text-gray-400 text-[11px] font-bold uppercase tracking-widest transition-all mt-2 border-t border-[#1a1a1a]/50 w-full">
                        <Plus size={14}/> Add Habit Property
                      </button>
                    </div>

                    <div className="mt-auto pt-8 space-y-8">
                      {masterTasks.filter(t => t.type === 'counter').map(t => (
                        <div key={t.id} className="flex flex-col items-center gap-3 py-6 px-4 bg-[#111] rounded-xl border border-[#1a1a1a] shadow-inner">
                          <span className="text-[10px] font-black uppercase text-gray-600 tracking-[0.2em]">{t.name}</span>
                          <div className="flex flex-col items-center gap-2">
                             <span className="text-4xl font-black text-white">
                                {counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}
                             </span>
                             <div className="w-48 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#222]">
                                <div className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${percentage}%` }} />
                             </div>
                          </div>
                        </div>
                      ))}

                      {masterTasks.filter(t => t.type === 'notes').map(t => (
                        <div key={t.id} className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <StickyNote size={14} className="text-gray-600"/>
                            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">{t.name}</span>
                          </div>
                          <textarea 
                            className={`w-full bg-[#111] border border-[#1a1a1a] rounded-xl p-4 text-gray-300 placeholder:text-gray-800 outline-none focus:border-[#2a2a2a] transition-all min-h-[150px] leading-relaxed ${textSize === 'large' ? 'text-base' : textSize === 'medium' ? 'text-sm' : 'text-[13px]'}`}
                            placeholder="How was your day? Log your thoughts here..." 
                            defaultValue={record.notes || ''} 
                            onBlur={(e) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'records', record.id), { notes: (e.target as HTMLTextAreaElement).value })} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'card' ? (
            <div className="space-y-10 pb-20 w-full">
              {weeklyGroups.map(([key, group]) => (
                <div key={key} className="space-y-4 w-full">
                  <div className="flex items-center gap-3">
                    <button onClick={() => {
                      const next = new Set(collapsedWeeks);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      setCollapsedWeeks(next);
                    }} className="flex items-center gap-2 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-gray-400 transition-colors">
                      {collapsedWeeks.has(key) ? <ChevronRight size={10}/> : <ChevronDown size={10}/>}
                      {group.label}
                    </button>
                    <div className="flex-1 h-[1px] bg-[#1a1a1a]" />
                  </div>
                  {!collapsedWeeks.has(key) && (
                    <div className={`grid gap-4 w-full ${isPeek ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 2xl:grid-cols-8'}`}>
                      {group.items.map(record => {
                        const dateObj = parseISO(record.date);
                        const habits = masterTasks.filter(t => t.type === 'habit');
                        const completedCount = habits.filter(h => !!record.data?.[h.id]).length;
                        const totalCount = habits.length;
                        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                        return (
                          <div 
                            key={record.id} 
                            onClick={() => { if (!isPeek) { setSidePeekPageId(pageId); setSidePeekRecordId(record.id); } }}
                            className={`bg-[#1e1e1e] border border-[#2d2d2d] rounded-[8px] flex flex-col hover:border-[#3d3d3d] transition-all group/card relative overflow-hidden h-fit ${!isPeek ? 'min-h-0 md:min-h-[160px]' : 'min-h-[160px]'} shadow-sm ${!isPeek ? 'cursor-pointer' : ''}`}
                          >
                            <div className={`h-24 w-full relative overflow-hidden shrink-0 border-b border-[#1a1a1a] bg-[#161616] ${(!isPeek && !record.coverImage) ? 'hidden md:block' : ''}`}>
                              {record.coverImage?.url && (
                                <img 
                                  src={record.coverImage.url + (record.coverImage.type === 'preset' ? (record.coverImage.url.includes('?') ? '&w=600' : '?w=600') : '')} 
                                  className="w-full h-full object-cover opacity-0 transition-opacity duration-700" 
                                  style={{ objectPosition: `50% ${record.coverImage.position || 50}%` }}
                                  onLoad={(e) => (e.target as HTMLImageElement).classList.replace('opacity-0', 'opacity-100')}
                                  onError={(e) => (e.target as HTMLImageElement).classList.replace('opacity-0', 'opacity-50')}
                                  loading="lazy"
                                  alt="" 
                                />
                              )}
                            </div>
                            <div className="p-2 pb-1.5 border-b border-[#1a1a1a] bg-[#222]/30 flex justify-between items-start">
                              <div>
                                <span className={`font-black uppercase tracking-[0.2em] mb-0.5 block ${getDateHeaderClasses()} ${isSameDay(dateObj, new Date()) ? 'text-blue-400' : 'text-gray-600'}`}>
                                   {isSameDay(dateObj, new Date()) ? '@Today' : isSameDay(dateObj, subDays(new Date(), 1)) ? '@Yesterday' : `@${format(dateObj, 'EEEE')}`}
                                </span>
                                <h3 className={`font-bold text-white tracking-tight ${getDateValClasses()}`}>{format(dateObj, 'MMM d, yyyy')}</h3>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: record.id, label: format(dateObj, 'MMM d') }); }} className="opacity-0 group-hover/card:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all"><Trash2 size={11}/></button>
                            </div>
                            <div className="p-1 flex-1 flex flex-col">
                              <div className="space-y-0 min-h-[40px]">
                                <SortableContext items={masterTasks.map(t => `${record.id}::${t.id}`)} strategy={verticalListSortingStrategy}>
                                  {masterTasks.filter(t => !t.parentId && (t.type === 'habit' || t.type === 'toggle_list')).map(task => (
                                    <SortableMasterItem 
                                      key={task.id} 
                                      id={`${record.id}::${task.id}`} 
                                      task={task} 
                                      allTasks={masterTasks}
                                      completed={!!record.data?.[task.id]} 
                                      recordData={record.data || {}}
                                      isPeek={false}
                                      streak={gamificationStats?.taskStreaks?.[task.id]?.streak || 0}
                                      onToggle={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} 
                                      onToggleSubTask={(subId: string, current: boolean) => toggleSubTask(record.id, task.id, subId, current)}
                                      onContextMenu={(e: any) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, taskId: task.id }); }} 
                                      isEditing={editingTaskId === task.id} 
                                      onRename={(newName: string) => { updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', task.id), { name: newName }); setEditingTaskId(null); }} 
                                      textSizeClass={getTextClasses()} 
                                      checkboxScale={getCheckboxScale()} 
                                      textTruncateMode={textTruncateMode}
                                    />
                                  ))}
                                </SortableContext>
                              </div>
                              <div className="mt-auto pt-2 space-y-2 border-t border-[#1a1a1a]/30">
                                {masterTasks.filter(t => t.type === 'counter').map(t => (
                                  <div key={t.id} className="px-1.5 py-1 bg-[#161616] rounded border border-[#1a1a1a] flex justify-between items-center">
                                    <span className={`font-black uppercase text-gray-600 tracking-widest ${getSectionTitleClasses()}`}>{t.name}</span>
                                    <span className={`font-black text-blue-500/80 ${getSectionContentClasses()}`}>{counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}</span>
                                  </div>
                                ))}
                                {masterTasks.filter(t => t.type === 'notes').map(t => (
                                  <div key={t.id} onClick={(e) => e.stopPropagation()} className={`px-1.5 py-1.5 bg-[#161616] rounded border border-[#1a1a1a] space-y-1 ${!isPeek ? 'hidden md:block' : ''}`}>
                                    <span className={`font-black uppercase text-gray-600 tracking-widest block ${getSectionTitleClasses()}`}>{t.name}</span>
                                    <textarea 
                                      className={`w-full bg-transparent text-gray-400 placeholder:text-gray-800 outline-none resize-none p-0 border-none leading-tight ${getSectionContentClasses()}`} 
                                      placeholder="Daily log..." 
                                      defaultValue={record.notes || ''} 
                                      onClick={(e) => e.stopPropagation()}
                                      onBlur={(e) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'records', record.id), { notes: (e.target as HTMLTextAreaElement).value })} 
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button onClick={() => setIsDatePickerOpen({})} className="bg-transparent border border-dashed border-[#2d2d2d] rounded-[8px] flex flex-col items-center justify-center p-4 hover:bg-[#1a1a1a] hover:border-[#3d3d3d] transition-all group/add h-full min-h-[160px]">
                        <Plus size={20} className="text-gray-700 group-hover/add:text-gray-400 transition-colors" />
                        <span className="text-[9px] font-black uppercase text-gray-700 group-hover/add:text-gray-400 tracking-widest mt-2">Add Day</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[#1a1a1a] overflow-x-auto custom-scrollbar bg-[#111] w-full">
              <table className="w-full text-left border-collapse min-w-[800px] md:min-w-0">
                <thead>
                  <tr className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
                    <th className="p-4 font-black text-[9px] uppercase tracking-widest text-gray-600 border-r border-[#1a1a1a] w-[180px]">Date Record</th>
                     {masterTasks.filter(t => t.type !== 'notes' && t.type !== 'toggle_list').map(task => {
                       const streak = gamificationStats?.taskStreaks?.[task.id]?.streak || 0;
                       return (
                         <th key={task.id} className="p-4 font-black text-[9px] uppercase tracking-widest text-gray-500 min-w-[120px] text-center">
                           <div className="flex items-center justify-center gap-1">
                             <span>{task.name}</span>
                             {streak > 0 && <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1 rounded shrink-0">🔥 {streak}</span>}
                           </div>
                         </th>
                       );
                     })}
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => {
                    const habits = masterTasks.filter(t => t.type === 'habit');
                    const completedCount = habits.filter(h => !!record.data?.[h.id]).length;
                    const totalCount = habits.length;
                    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    return (
                      <tr key={record.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors group/row">
                        <td className={`p-4 font-bold text-gray-400 border-r border-[#1a1a1a] ${getTextClasses()}`}>{format(parseISO(record.date), 'EEE, MMM d')}</td>
                        {masterTasks.filter(t => t.type !== 'notes' && t.type !== 'toggle_list').map(task => (
                          <td key={task.id} className="p-2 text-center border-r border-[#1a1a1a]/50">
                            {task.type === 'habit' ? (
                              <div className={getCheckboxScale()}><Checkbox checked={!!record.data?.[task.id]} onClick={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} /></div>
                            ) : task.type === 'counter' ? (
                              <span className={`font-black text-blue-500/80 uppercase ${getTextClasses()}`}>{counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}</span>
                            ) : '-'}
                          </td>
                        ))}
                        <td className="p-2 text-right">
                          <button onClick={() => setConfirmDelete({ id: record.id, label: format(parseISO(record.date), 'MMM d') })} className="opacity-0 group-hover/row:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all"><Trash2 size={12}/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && deleteRecord(confirmDelete.id)} title="Delete Date Record" message={`Are you sure you want to delete this day? This will permanently remove all logs for ${confirmDelete?.label}.`} />
      <DatePickerModal isOpen={!!isDatePickerOpen} onClose={() => setIsDatePickerOpen(null)} initialDate={isDatePickerOpen?.initialDate} onSelect={async (date: Date) => { 
        if (!user) return; 
        const dateStr = format(date, 'yyyy-MM-dd'); 
        const data: any = { 
          id: `rec_${dateStr}`, 
          date: dateStr, 
          data: {} 
        };
        if (pageMeta?.defaultRecordCover) {
          data.coverImage = pageMeta.defaultRecordCover;
        }
        await setDoc(doc(db, 'users', user.uid, 'pages', pageId, 'records', `rec_${dateStr}`), data); 
        setIsDatePickerOpen(null); 
      }} />
      {contextMenu && (
        <div className="fixed z-[9999] bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-2xl py-1 min-w-[150px]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setEditingTaskId(contextMenu.taskId); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-[11px] font-bold text-gray-300 hover:bg-[#252526] flex items-center gap-2"><Edit3 size={12}/> Rename</button>
          <button onClick={() => { duplicateMasterTask(contextMenu.taskId); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-[11px] font-bold text-gray-300 hover:bg-[#252526] flex items-center gap-2"><Copy size={12}/> Duplicate</button>
          <div className="h-[1px] bg-[#2d2d2d] my-1" />
          <button onClick={() => { deleteMasterTask(contextMenu.taskId); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-[11px] font-bold text-red-400 hover:bg-[#252526] flex items-center gap-2"><Trash2 size={12}/> Delete Everywhere</button>
        </div>
      )}
      <Modal isOpen={isPropertyModalOpen} onClose={() => setIsPropertyModalOpen(false)} title="Master Task Definitions" maxWidth="750px">
        <div className="space-y-4 p-1">
          <div className="flex gap-2 pb-4 border-b border-[#1a1a1a]">
            <button onClick={() => addMasterTask('habit')} className="flex-1 py-2.5 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-400 hover:text-white hover:border-[#3d3d3d] transition-all"><Plus size={16}/> <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider">Habit</span></button>
            <button onClick={() => addMasterTask('counter')} className="flex-1 py-2.5 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-400 hover:text-white hover:border-[#3d3d3d] transition-all"><Activity size={16}/> <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider">Counter</span></button>
            <button onClick={() => addMasterTask('notes')} className="flex-1 py-2.5 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-400 hover:text-white hover:border-[#3d3d3d] transition-all"><StickyNote size={16}/> <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider">Notes</span></button>
            <button onClick={() => addMasterTask('toggle_list')} className="flex-1 py-2.5 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-400 hover:text-white hover:border-[#3d3d3d] transition-all"><ChevronDown size={16}/> <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider">Toggle List</span></button>
          </div>
          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={async (event) => {
                const { active, over } = event;
                if (!over || active.id === over.id || !user) return;
                const oldIndex = masterTasks.findIndex(t => t.id === active.id);
                const newIndex = masterTasks.findIndex(t => t.id === over.id);
                const newOrder = arrayMove(masterTasks, oldIndex, newIndex);
                let sortOrder;
                if (newIndex === 0) sortOrder = safeParse(newOrder[1]?.sortOrder).genPrev().toString();
                else if (newIndex === newOrder.length - 1) sortOrder = safeParse(newOrder[newIndex - 1]?.sortOrder).genNext().toString();
                else sortOrder = safeParse(newOrder[newIndex - 1]?.sortOrder).between(safeParse(newOrder[newIndex + 1]?.sortOrder)).toString();
                await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', active.id.toString()), { sortOrder });
              }}
            >
              <SortableContext items={masterTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {masterTasks.map(task => (
                  <SortableModalRow key={task.id} task={task} allTasks={masterTasks} onDelete={deleteMasterTask} onRename={(id, name) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', id), { name })} onUpdate={(id, updates) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', id), updates)} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </Modal>
      <Modal isOpen={isDefaultCoverModalOpen} onClose={() => setIsDefaultCoverModalOpen(false)} title="Default Card Cover">
        <div className="space-y-4 p-1">
          <p className="text-[10px] text-gray-500 mb-4">Set an image that will be automatically applied to any new daily log record created in this dashboard.</p>
          <div className="rounded-xl overflow-hidden border border-[#2d2d2d]">
            <CoverImage 
              pageId={pageId} 
              isDefault={true} 
              coverImage={pageMeta?.defaultRecordCover} 
            />
          </div>
        </div>
      </Modal>

      {/* Side Peek Shop */}
      {isShopOpen && (
        <>
          <div 
            onClick={() => setIsShopOpen(false)} 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] transition-opacity duration-300 animate-fade-in"
          />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#141414] border-l border-[#2d2d2d] z-[200] shadow-2xl p-6 flex flex-col h-full overflow-hidden transition-all duration-300 ease-out transform translate-x-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2d2d2d] mb-4 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className="text-yellow-500 animate-pulse shrink-0" size={18} />
                <div className="min-w-0">
                  <h2 className="text-[12px] font-black uppercase tracking-wider text-yellow-500 font-black truncate">Gold & Buff Shop</h2>
                  <span className="text-[10px] text-gray-500 font-bold block mt-0.5">Available: {(gamificationStats?.points || 0).toLocaleString()} pts</span>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <button 
                  onClick={() => setIsEditMode(!isEditMode)} 
                  className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${isEditMode ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-black' : 'bg-[#222] border border-[#333] text-gray-400 hover:text-white'}`}
                >
                  {isEditMode ? 'Exit Edit' : 'Edit Shop'}
                </button>
                <button onClick={() => setIsShopOpen(false)} className="p-1.5 text-gray-500 hover:text-white hover:bg-[#222] rounded transition-all flex items-center justify-center cursor-pointer" title="Close Shop">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar overscroll-contain touch-pan-y">
              {isEditMode && (
                <button 
                  onClick={() => setNewItemModal(true)} 
                  className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600/10 border border-dashed border-purple-500/30 text-purple-400 hover:text-white hover:bg-purple-600/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  <Plus size={14} /> Add Custom Shop Item
                </button>
              )}

              {shopItems.length === 0 ? (
                <div className="text-center py-16 text-gray-500 border border-dashed border-[#2d2d2d] rounded-xl text-sm font-bold">
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
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-gray-200 truncate">{item.name}</h3>
                            <span className="text-[8px] font-black uppercase tracking-wider text-gray-600 bg-[#1a1a1a] px-1 py-0.2 rounded border border-[#2d2d2d]">{item.type}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                          {item.durationHours && item.durationHours > 0 ? (
                            <span className="text-[9px] text-blue-500 font-bold block mt-1">
                              Duration: {item.durationValue || item.durationHours} {item.durationUnit || 'hours'}
                            </span>
                          ) : null}
                        </div>
                        
                        {isEditMode ? (
                          <div className="flex gap-1 shrink-0 z-10">
                            <button 
                              onClick={() => setEditingItem(item)} 
                              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit2 size={13} />
                            </button>
                            {!(item.name.toLowerCase().includes('streak insurance') || item.name.toLowerCase().includes('holiday pass')) && (
                              <button 
                                onClick={() => handleDeleteShopItem(item.id)} 
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer"
                                title="Delete Item"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleBuyItem(item)}
                            className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-purple-500/10 cursor-pointer"
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
    </DndContext>
  );
}

function DatePickerModal({ isOpen, onClose, onSelect, initialDate }: any) {
  const [viewDate, setViewDate] = useState(initialDate || new Date());
  const [yearPicker, setYearPicker] = useState(false);
  useEffect(() => { if (isOpen) setViewDate(initialDate || new Date()); }, [isOpen, initialDate]);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewDate]);
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Date">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button onClick={() => setYearPicker(!yearPicker)} className="text-[11px] font-black uppercase tracking-widest text-gray-300 hover:text-white flex items-center gap-1 transition-colors">
              {format(viewDate, 'MMMM yyyy')} <ChevronDown size={12} className={yearPicker ? 'rotate-180 transition-transform' : 'transition-transform'}/>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1.5 text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded-md transition-all"><ChevronLeft size={16}/></button>
            <button onClick={() => setViewDate(new Date())} className="px-2 py-1 text-[9px] font-black text-gray-600 uppercase hover:text-blue-400 transition-all">Today</button>
            <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1.5 text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded-md transition-all"><ChevronRight size={16}/></button>
          </div>
        </div>
        {yearPicker ? (
          <div className="grid grid-cols-4 gap-2 h-[240px] overflow-auto custom-scrollbar pr-2">
            {Array.from({ length: 21 }, (_, i) => 2020 + i).map(y => (
              <button key={y} onClick={() => { setViewDate(setYear(viewDate, y)); setYearPicker(false); }} className={`py-3 text-[11px] font-bold rounded-lg transition-all ${getYear(viewDate) === y ? 'bg-[#2383e2] text-white' : 'bg-[#1a1a1a] text-gray-500 hover:text-white'}`}>{y}</button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {['M','T','W','T','F','S','S'].map((d,i)=><div key={i} className="text-center text-[9px] font-black text-gray-700 p-2">{d}</div>)}
            {days.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelected = isSameDay(day, viewDate);
              return (
                <button key={i} onClick={() => onSelect(day)} className={`relative p-2.5 text-[10.5px] rounded-lg font-bold transition-all flex items-center justify-center ${isSelected ? 'bg-[#2383e2] text-white shadow-lg shadow-blue-500/20' : !isCurrentMonth ? 'text-gray-800' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'} ${isToday && !isSelected ? 'border border-blue-500/30' : ''}`}>
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SortableMasterItem(props: any) {
  const { 
    id, 
    task, 
    allTasks,
    completed, 
    onToggle, 
    onToggleSubTask, 
    recordData, 
    isPeek, 
    streak = 0, 
    onContextMenu, 
    isEditing, 
    onRename, 
    textSizeClass, 
    checkboxScale,
    textTruncateMode = 'wrap'
  } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !isPeek });
  const style = isPeek ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 } : {};
  const [tempName, setTempName] = useState(task.name);
  
  // Persist expanded state in local storage keyed by task.id
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`subtasks_expanded_${task.id}`);
      return saved === 'true';
    }
    return false;
  });

  const toggleExpanded = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    localStorage.setItem(`subtasks_expanded_${task.id}`, String(nextState));
  };

  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);
  
  if (task.type === 'toggle_list') {
    const children = (allTasks || []).filter((t: any) => t.parentId === task.id && t.type === 'habit');
    const recordId = id.split('::')[0];
    
    return (
      <div ref={setNodeRef} style={style} className="flex flex-col mt-4 group">
        <div className="flex items-center gap-2 py-3 px-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-400 touch-none px-1">
            <GripVertical size={16} />
          </div>
          <button onClick={toggleExpanded} className="p-1 text-gray-500 hover:text-white transition-colors">
            <ChevronDown size={18} className={`transition-transform duration-200 ${!isExpanded ? '-rotate-90' : ''}`} />
          </button>
          {isEditing ? (
            <input 
              ref={inputRef} 
              value={tempName} 
              onChange={e => setTempName(e.target.value)} 
              onBlur={() => onRename(tempName)} 
              onKeyDown={e => { if (e.key === 'Enter') onRename(tempName); }} 
              className={`bg-transparent outline-none border-b border-purple-500 font-black text-white uppercase tracking-widest flex-1 ${textSizeClass}`} 
            />
          ) : (
            <span 
              onContextMenu={onContextMenu} 
              className={`font-black text-white uppercase tracking-widest flex-1 cursor-context-menu ${textTruncateMode === 'truncate' ? 'truncate whitespace-nowrap overflow-hidden block' : 'whitespace-normal break-words'} ${textSizeClass}`}
            >
              {task.name}
            </span>
          )}
        </div>
        {isExpanded && children.length > 0 && (
          <div className="ml-6 pl-2 border-l border-[#2d2d2d] space-y-0.5 mt-1">
            <SortableContext items={children.map((c: any) => `${recordId}::${c.id}`)} strategy={verticalListSortingStrategy}>
              {children.map((child: any) => (
                <SortableMasterItem 
                  key={child.id} 
                  {...props} 
                  id={`${recordId}::${child.id}`} 
                  task={child} 
                  completed={!!recordData?.[child.id]} 
                />
              ))}
            </SortableContext>
          </div>
        )}
      </div>
    );
  }

  if (task.type !== 'habit') return null;
  
  const hasSubtasks = task.subTasks && task.subTasks.length > 0;
  // Proportional sizing for subtasks inside the side peek vs main cards list
  const subTextSizeClass = isPeek
    ? (textSizeClass.includes('text-[19px]') ? 'text-[15px]' : textSizeClass.includes('text-[17px]') ? 'text-[14px]' : 'text-[13px]')
    : 'text-[12px]';

  const subCheckboxScale = isPeek ? 'scale-[0.85]' : 'scale-[0.8]';

  return (
    <div ref={isPeek ? setNodeRef : null} style={style} className="flex flex-col mb-1 group/item">
      <div onContextMenu={onContextMenu} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 px-1 py-0.5 rounded-md hover:bg-[#252526] transition-all min-h-[22px]">
        {isPeek && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
            <GripVertical size={10} className="text-gray-800" />
          </div>
        )}
        
        {hasSubtasks ? (
          <button onClick={toggleExpanded} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 cursor-pointer">
            <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <div className="w-[14px] shrink-0" /> // Perfect Alignment Spacer
        )}

        <div className={`${checkboxScale} origin-left shrink-0`} onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={completed} onClick={onToggle} />
        </div>
        
        {isEditing ? (
          <input ref={inputRef} className={`flex-1 bg-transparent font-medium text-blue-400 outline-none border-b border-blue-500/50 ${textSizeClass}`} value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={() => onRename(tempName)} onKeyDown={(e) => { if (e.key === 'Enter') onRename(tempName); if (e.key === 'Escape') onRename(task.name); }} />
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
            <span className={`font-medium tracking-tight transition-all ${
              completed ? 'text-gray-700 line-through' : 'text-gray-400'
            } ${
              textTruncateMode === 'truncate' ? 'truncate whitespace-nowrap overflow-hidden block w-full text-left' : 'whitespace-normal break-words text-left'
            } ${textSizeClass}`}>{task.name}</span>
            {streak > 0 && (
              <span className="text-[10px] text-amber-500 font-bold shrink-0 flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.2 rounded hover:bg-amber-500/20 transition-all select-none">
                🔥 {streak}
              </span>
            )}
          </div>
        )}
      </div>

      {isExpanded && hasSubtasks && (
        <div className="ml-8 pl-2 border-l-2 border-[#1a1a1a] mt-1 space-y-1">
          {task.subTasks.map((sub: any) => {
            const subKey = `${task.id}_${sub.id}`;
            const subCompleted = !!recordData?.[subKey];
            return (
              <div key={sub.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#1a1a1a] transition-colors min-w-0 cursor-pointer" onClick={() => onToggleSubTask(sub.id, subCompleted)}>
                <div className={`${subCheckboxScale} origin-left shrink-0`} onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={subCompleted} onClick={() => onToggleSubTask(sub.id, subCompleted)} />
                </div>
                <span className={`transition-colors flex-1 min-w-0 text-left ${
                  subCompleted ? 'text-gray-600 line-through' : 'text-gray-400'
                } ${
                  textTruncateMode === 'truncate' ? 'truncate whitespace-nowrap overflow-hidden block' : 'whitespace-normal break-words'
                } ${subTextSizeClass}`}>
                  {sub.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortableModalRow({ task, allTasks, onDelete, onRename, onUpdate }: { task: MasterTask; allTasks: MasterTask[]; onDelete: (id: string) => void; onRename: (id: string, name: string) => void; onUpdate?: (id: string, updates: any) => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const Icon = task.type === 'notes' ? StickyNote : task.type === 'counter' ? Activity : task.type === 'toggle_list' ? ChevronDown : Check;
  const [expanded, setExpanded] = useState(false);
  const [newSubTask, setNewSubTask] = useState('');

  const toggleLists = allTasks.filter(t => t.type === 'toggle_list' && t.id !== task.id);

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col bg-[#1e1e1e] border border-[#2d2d2d] rounded-[8px] hover:border-[#3d3d3d] group">
      <div className="flex items-center gap-3 p-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 text-gray-600 hover:text-gray-400 transition-colors">
          <GripVertical size={16} />
        </div>
        <div className="w-5 flex justify-center shrink-0">
          <Icon size={14} className="text-gray-500" />
        </div>
        <input
          className="flex-1 bg-transparent text-[13px] font-bold text-gray-200 outline-none min-w-0"
          defaultValue={task.name}
          onBlur={(e) => onRename(task.id, (e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        {(task.type === 'habit' || task.type !== 'toggle_list') && onUpdate && (
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors shrink-0">
            <Settings size={16} />
          </button>
        )}
        <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-500 transition-all shrink-0">
          <Trash2 size={16} />
        </button>
      </div>

      {expanded && onUpdate && (
        <div className="p-5 pt-2 border-t border-[#2d2d2d] mt-1 space-y-4 text-left">
          {/* Global Property Settings */}
          {task.type !== 'toggle_list' && toggleLists.length > 0 && (
            <div className="flex flex-col gap-1 pb-3 border-b border-[#2d2d2d]/50">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Parent List</span>
              <select
                className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                value={task.parentId || ''}
                onChange={(e) => onUpdate(task.id, { parentId: e.target.value || null })}
              >
                <option value="">None (Root Level)</option>
                {toggleLists.map(tl => (
                  <option key={tl.id} value={tl.id}>{tl.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Main Task Settings (Habits only) */}
          {task.type === 'habit' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                {task.rewardMode === 'subtasks_separately' ? 'Main Task Completion Bonus' : 'Main Task Base Points'}
              </span>
              <input 
                type="number" 
                className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                defaultValue={task.pointsValue || 10}
                onBlur={(e) => onUpdate(task.id, { pointsValue: parseInt(e.target.value) || 10 })}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Reward Mode</span>
              <select
                className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                value={task.rewardMode || 'main_only'}
                onChange={(e) => onUpdate(task.id, { rewardMode: e.target.value })}
              >
                <option value="main_only">Reward Main Task Only</option>
                <option value="subtasks_separately">Reward Sub-Tasks Separately</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t border-[#2d2d2d]/50 pt-3">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Sub-Task Completion Rule</span>
            <select
              className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
              value={task.autoTickMode || 'manual'}
              onChange={(e) => onUpdate(task.id, { autoTickMode: e.target.value })}
            >
              <option value="manual">Manual Check Only</option>
              <option value="any">Auto-Complete when ANY sub-task is completed</option>
              <option value="all">Auto-Complete when ALL sub-tasks are completed</option>
            </select>
          </div>
          
          <div className="space-y-1.5 border-t border-[#2d2d2d]/50 pt-3">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Sub-Tasks List</span>
            <div className="space-y-1.5 mt-1 max-h-40 overflow-y-auto custom-scrollbar">
              {(task.subTasks || []).map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-3 px-3 py-2 bg-[#111] rounded border border-[#2d2d2d] hover:border-[#333] transition-colors">
                  <input 
                    type="text"
                    className="text-[12.5px] font-medium text-gray-200 flex-1 bg-transparent border-none outline-none focus:border-b focus:border-purple-500/50 transition-colors"
                    defaultValue={sub.title}
                    onBlur={(e) => {
                      const newTitle = e.target.value.trim();
                      if (!newTitle) return;
                      const newSubs = task.subTasks!.map(s => s.id === sub.id ? { ...s, title: newTitle } : s);
                      onUpdate(task.id, { subTasks: newSubs });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                  
                  {task.rewardMode === 'subtasks_separately' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9.5px] text-gray-500 font-black uppercase tracking-wider">Points</span>
                      <input 
                        type="number"
                        className="w-14 bg-[#1a1a1a] border border-[#2d2d2d] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-purple-400 outline-none focus:border-purple-500 transition-colors"
                        defaultValue={sub.points ?? 2}
                        onBlur={(e) => {
                          const pointsVal = parseInt(e.target.value) || 0;
                          const newSubs = task.subTasks!.map(s => s.id === sub.id ? { ...s, points: pointsVal } : s);
                          onUpdate(task.id, { subTasks: newSubs });
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>
                  )}

                  <button onClick={() => {
                    const newSubs = task.subTasks!.filter(s => s.id !== sub.id);
                    onUpdate(task.id, { subTasks: newSubs });
                  }} className="text-gray-500 hover:text-red-500 p-0.5 shrink-0"><Trash2 size={13}/></button>
                </div>
              ))}
              {(task.subTasks || []).length === 0 && (
                <div className="text-[11.5px] text-gray-500 py-1 italic text-center">No sub-tasks configured.</div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <input 
                type="text" 
                value={newSubTask}
                onChange={e => setNewSubTask(e.target.value)}
                placeholder="Type new sub-task and press Enter..."
                className="flex-1 bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] text-white outline-none focus:border-purple-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubTask.trim()) {
                    const subId = Date.now().toString();
                    const newSubs = [...(task.subTasks || []), { id: subId, title: newSubTask.trim(), points: 2 }];
                    onUpdate(task.id, { subTasks: newSubs });
                    setNewSubTask('');
                  }
                }}
              />
            </div>
          </div>
            </>
          )}
        </div>
      )}
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
  const [durationValue, setDurationValue] = useState<number>(initialItem?.durationValue || initialItem?.durationHours || 24);
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours'>(initialItem?.durationUnit || 'hours');

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name);
      setDescription(initialItem.description);
      setCost(initialItem.cost);
      setType(initialItem.type);
      setDurationValue(initialItem.durationValue || initialItem.durationHours || 24);
      setDurationUnit(initialItem.durationUnit || 'hours');
    } else {
      setName('');
      setDescription('');
      setCost(100);
      setType('buff');
      setDurationValue(24);
      setDurationUnit('hours');
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
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="buff">Buff (Temporal)</option>
              <option value="timer">Timer (Focus)</option>
              <option value="note">Note (Task Attachment)</option>
              <option value="instant">Instant (Consumable)</option>
            </select>
          </div>
        </div>

        {(type === 'buff' || type === 'timer') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">
                {type === 'buff' ? 'Buff Duration' : 'Timer Duration'}
              </label>
              <input 
                type="number" 
                step="any"
                value={durationValue} 
                onChange={(e) => setDurationValue(Math.max(0.01, parseFloat(e.target.value) || 0))} 
                className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50" 
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Duration Unit</label>
              <select 
                value={durationUnit} 
                onChange={(e) => setDurationUnit(e.target.value as 'minutes' | 'hours')} 
                className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="hours">Hours</option>
                <option value="minutes">Minutes</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-[#222] mt-4">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-[#222] text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              if (!name.trim()) return;
              const calculatedHours = durationUnit === 'minutes' ? durationValue / 60 : durationValue;
              onSubmit({ 
                name, 
                description, 
                cost, 
                type, 
                durationHours: calculatedHours,
                durationValue,
                durationUnit
              });
            }} 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} /> {initialItem ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
