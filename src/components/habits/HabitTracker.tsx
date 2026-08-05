'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, orderBy, writeBatch, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { Plus, Minus, Trash2, Table as TableIcon, LayoutGrid, Check, Type, Hash, Calendar as CalendarIcon, Settings2, GripVertical, MoreVertical, Copy, Edit3, ChevronDown, ChevronRight, Edit, X, ChevronLeft, StickyNote, Activity, Type as TypeIcon, Settings, Image as ImageIcon, Gamepad2, ShoppingBag, Shield, Timer, Sparkles, Package, Edit2, Receipt, FileText, Pencil } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Checkbox } from '@/components/ui/Checkbox';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useRouter, usePathname } from '@/context/RouterContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modals';
import { PageModel, HabitStats, ShopItem, InventoryItem } from '@/types';
import { useNotification } from '@/context/NotificationContext';
import { format, isSameDay, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, parseISO, addDays, isAfter, isSameWeek, getYear, getMonth, addMonths, subMonths, setYear, setMonth, isSameMonth } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';

function parseNotesWithLinks(text: string, pages: PageModel[]): React.ReactNode {
  if (!text) {
    return <span className="text-gray-700 italic">No notes logged...</span>;
  }

  const urlRegex = /(https?:\/\/[^\s\n]+|www\.[^\s\n]+)/gi;
  const pageRegex = /\[@([^\]]+)\]\(\/page\/([^\)]+)\)/g;
  
  let matches: any[] = [];
  let match;
  
  // 1. Find all Page mentions
  pageRegex.lastIndex = 0;
  while ((match = pageRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'page',
      title: match[1],
      pageId: match[2],
      url: `/page/${match[2]}`
    });
  }
  
  // 2. Find all URLs
  urlRegex.lastIndex = 0;
  while ((match = urlRegex.exec(text)) !== null) {
    const uIndex = match.index;
    const uLen = match[0].length;
    const insidePageLink = matches.some(m => uIndex >= m.index && (uIndex + uLen) <= (m.index + m.length));
    if (!insidePageLink) {
      matches.push({
        index: uIndex,
        length: uLen,
        type: 'url',
        title: match[0],
        url: match[0].toLowerCase().startsWith('www.') ? `https://${match[0]}` : match[0]
      });
    }
  }
  
  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  
  matches.forEach((m, idx) => {
    if (m.index > lastIndex) {
      elements.push(<span key={`text-seq-${idx}`}>{text.substring(lastIndex, m.index)}</span>);
    }
    
    if (m.type === 'page') {
      elements.push(
        <button 
          key={`page-lnk-${idx}`} 
          type="button" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.hash = m.url;
          }}
          className="text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/20 transition-all font-sans text-[11px] align-middle cursor-pointer"
        >
          <StickyNote size={11} className="text-purple-400 shrink-0" />
          <span>@{m.title}</span>
        </button>
      );
    } else {
      elements.push(
        <a 
          key={`url-lnk-${idx}`} 
          href={m.url} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-400 hover:underline hover:text-blue-300 break-all inline"
        >
          {m.title}
        </a>
      );
    }
    
    lastIndex = m.index + m.length;
  });
  
  if (lastIndex < text.length) {
    elements.push(<span key="text-seq-end">{text.substring(lastIndex)}</span>);
  }
  
  return <span className="leading-relaxed whitespace-pre-wrap select-text">{elements}</span>;
}
import { CSS } from '@dnd-kit/utilities';
import { LexoRank } from 'lexorank';
import { CoverImage } from '@/components/ui/CoverImage';
import { GamificationDashboard } from './GamificationDashboard';
import { WeeklyTasksDashboard } from './WeeklyTasksDashboard';
import { TodoDashboard } from './TodoDashboard';
import { ScheduleDashboard } from './ScheduleDashboard';
import { playAscendingFanfare, playDing } from '@/lib/sounds';

type PropertyType = 'habit' | 'counter' | 'notes' | 'toggle_list' | 'task_counter';
type TextSize = 'small' | 'medium' | 'large';

export interface MasterTask {
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
  bonusRequirement?: 'all_subtasks' | 'main_task';
  subTaskPoints?: number;
  bonusPoints?: number;
  sevenDayBonusPoints?: number;
  // Toggle List styling
  labelColor?: string;
  labelBold?: boolean;
  // Task Counter
  counterPoints?: number;       // Points per increment (can be negative)
  counterLimit?: number;        // Max daily completions (0 = unlimited)
  counterBonusPoints?: number;  // Bonus for first increment each day
  
  // Custom notes options
  notesMode?: 'separate' | 'sync';
  syncedNoteText?: string;
  period?: 'daily' | 'weekly';
}

export function getStartOfWeekDate(date: Date, resetDay: number): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0-6
  const diff = (day - resetDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface PageRecord {
  id: string;
  date: string;
  data: Record<string, boolean | number>;
  notes?: string;
  allHabitsBonusAwarded?: boolean;
  coverImage?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
}

export function HabitTracker({ pageId, isPeek = false }: { pageId: string, isPeek?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { sidePeekRecordId, setSidePeekRecordId, setSidePeekPageId } = useWorkspace();
  const [masterTasks, setMasterTasks] = useState<MasterTask[]>([]);
  const [records, setRecords] = useState<PageRecord[]>([]);
  const [weeklyRecords, setWeeklyRecords] = useState<PageRecord[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const [counterFormat, setCounterFormat] = useState<'fraction' | 'percent'>('fraction');
  const [textSize, setTextSize] = useState<TextSize>('small');
  const [daysSorting, setDaysSorting] = useState<'chrono' | 'reverse'>('chrono');
  const [textTruncateMode, setTextTruncateMode] = useState<'wrap' | 'truncate'>('wrap');
  const [pageMeta, setPageMeta] = useState<PageModel | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<{ initialDate?: Date } | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => setIsPropertyModalOpen(true);
    window.addEventListener('open-property-modal', handleOpenModal);
    return () => window.removeEventListener('open-property-modal', handleOpenModal);
  }, []);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDefaultCoverModalOpen, setIsDefaultCoverModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, taskId: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, label: string } | null>(null);
  const [isGamificationOpen, setIsGamificationOpen] = useState(false);
  const [isWeeklyTasksOpen, setIsWeeklyTasksOpen] = useState(false);
  const [isTodoOpen, setIsTodoOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [gamificationStats, setGamificationStats] = useState<HabitStats | null>(null);

  const currentStreak = gamificationStats?.currentStreak ?? 0;
  const longestStreak = gamificationStats?.longestStreak ?? 0;
  const lastActiveDate = gamificationStats?.lastActiveDate ?? "";
  const streakFrozen = gamificationStats?.streakFrozen ?? false;

  // Duolingo-style Streak Engine Checking on Load / Render
  useEffect(() => {
    if (!user || !pageId || !gamificationStats) return;

    const checkAndResetStreak = async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      
      const lastActive = gamificationStats.lastActiveDate || "";
      const currentST = gamificationStats.currentStreak ?? 0;
      const isFrozen = gamificationStats.streakFrozen ?? false;

      // Only check if lastActive is set and is older than yesterday
      if (lastActive && lastActive !== todayStr && lastActive !== yesterdayStr) {
        const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
        if (currentST > 0) {
          if (!isFrozen) {
            // Streak broken, reset to 0
            await updateDoc(statsRef, {
              currentStreak: 0,
            });
            showToast("Your 🔥 streak was reset. Keep up the daily habits!", "info");
          } else {
            // Streak was frozen! Save from reset, check is consumed
            await updateDoc(statsRef, {
              streakFrozen: false,
              lastActiveDate: yesterdayStr
            });
            showToast("Streak Freeze saved your 🔥 streak!", "success");
          }
        } else if (isFrozen) {
          // If 0 streak but frozen, just unfreeze
          await updateDoc(statsRef, {
            streakFrozen: false
          });
        }
      }
    };

    checkAndResetStreak();
  }, [user, pageId, gamificationStats?.lastActiveDate, gamificationStats?.currentStreak, gamificationStats?.streakFrozen]);
  
  // Shop & Inventory States
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [newItemModal, setNewItemModal] = useState(false);
  const [isSpendingModalOpen, setIsSpendingModalOpen] = useState(false);
  const [spendingPoints, setSpendingPoints] = useState<number>(0);
  const [spendingNote, setSpendingNote] = useState<string>('');
  const { showToast, confirm: customConfirm } = useNotification();
  const [allPages, setAllPages] = useState<PageModel[]>([]);

  // Custom point announcement toasts
  const [announcements, setAnnouncements] = useState<{ id: number; text: string; delta: number }[]>([]);
  const showPointAnnouncement = (text: string, delta: number) => {
    const id = Date.now() + Math.random();
    setAnnouncements(prev => [...prev, { id, text, delta }]);
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 2800);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Lock body scroll when modals/drawers are open on mobile
  useEffect(() => {
    const isModalOpen = !!sidePeekRecordId || isShopOpen || isPropertyModalOpen || isDefaultCoverModalOpen || isDatePickerOpen !== null || newItemModal || !!editingItem || isSpendingModalOpen;
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
    const savedSorting = localStorage.getItem(`habits_days_sorting_${pageId}`);
    if (savedSorting) setDaysSorting(savedSorting as 'chrono' | 'reverse');
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
    if (!isLoaded) return;
    localStorage.setItem(`habits_days_sorting_${pageId}`, daysSorting);
  }, [daysSorting, pageId, isLoaded]);

  useEffect(() => {
    if (!user || !pageId) return;
    const qMaster = query(collection(db, 'users', user.uid, 'pages', pageId, 'master_tasks'), orderBy('sortOrder', 'asc'));
    const unsubMaster = onSnapshot(qMaster, (snapshot) => {
      setMasterTasks(snapshot.docs.map(d => ({ type: 'habit', ...d.data(), id: d.id } as MasterTask)));
    });
    const qPages = query(collection(db, 'users', user.uid, 'pages'), orderBy('createdAt', 'asc'));
    const unsubPages = onSnapshot(qPages, (snapshot) => {
      setAllPages(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PageModel)));
    });
    const qRecords = query(collection(db, 'users', user.uid, 'pages', pageId, 'records'), orderBy('date', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PageRecord)));
    });
    const qWeeklyRecords = query(collection(db, 'users', user.uid, 'pages', pageId, 'weekly_records'), orderBy('date', 'desc'));
    const unsubWeeklyRecords = onSnapshot(qWeeklyRecords, (snapshot) => {
      setWeeklyRecords(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PageRecord)));
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
            type: 'instant',
            maxLimit: 3
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
        const items = snapshot.docs
          .map(d => ({ ...d.data(), id: d.id } as ShopItem))
          .filter(item => !item.name.toLowerCase().includes('holiday pass'));
        
        const updatedItems = items.map(item => {
          if (item.name.toLowerCase().includes('streak insurance') && item.type !== 'instant') {
            updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'shop_items', item.id), { type: 'instant' });
            return { ...item, type: 'instant' as const };
          }
          return item;
        });

        setShopItems(updatedItems);
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
      unsubMaster(); unsubRecords(); unsubWeeklyRecords(); unsubPage(); unsubStats(); unsubInv(); unsubShop(); unsubPages();
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

            const decayValue = stats.decayValue ?? 5;
            updates.points = stats.points - (diffDays * decayValue);
            updates.lastDecayDate = dateStr;
            
            if (updates.points < 0) updates.debt = true;
            
            const taskStreaks = { ...(stats.taskStreaks || {}) };
            let insuranceConsumed = false;
            let inventoryItems: InventoryItem[] = [];
            const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
            
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

              const invSnap = await getDoc(invRef);
              inventoryItems = invSnap.exists() ? (invSnap.data().items || []) : [];

              Object.keys(taskStreaks).forEach(taskId => {
                // If not completed yesterday, check Streak Insurance
                if (!yesterdayData[taskId]) {
                  const insuranceItem = inventoryItems.find((item: InventoryItem) => item.name.toLowerCase().includes('streak insurance') && item.quantity > 0);
                  if (insuranceItem) {
                    insuranceConsumed = true; // Streak Insurance protects it automatically.
                    inventoryItems = inventoryItems.map((item: InventoryItem) => (
                      item.id === insuranceItem.id ? { ...item, quantity: item.quantity - 1 } : item
                    )).filter((item: InventoryItem) => item.quantity > 0);
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
              await updateDoc(invRef, { items: inventoryItems });
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

  // Auto-create weekly record when stats load or week rolls over
  useEffect(() => {
    if (!user || !pageId) return;
    const createWeeklyRecord = async () => {
      const resetDay = gamificationStats?.weeklyResetDay ?? 1;
      const startOfWeekObj = getStartOfWeekDate(new Date(), resetDay);
      const weekStr = format(startOfWeekObj, 'yyyy-MM-dd');
      const recordId = `rec_week_${weekStr}`;
      const recordRef = doc(db, 'users', user.uid, 'pages', pageId, 'weekly_records', recordId);
      const snap = await getDoc(recordRef);
      if (!snap.exists()) {
        const data: Record<string, unknown> = { id: recordId, date: weekStr, data: {} };
        await setDoc(recordRef, data);
      }
    };
    createWeeklyRecord();
  }, [user, pageId, gamificationStats?.weeklyResetDay]);

  const weeklyGroups = useMemo(() => {
    const groups: Record<string, { label: string, items: PageRecord[] }> = {};
    const today = startOfDay(new Date());
    const weekStartsOn = ((gamificationStats?.weeklyResetDay ?? 1) % 7) as (0 | 1 | 2 | 3 | 4 | 5 | 6);
    records.forEach(r => {
      const d = parseISO(r.date);
      const weekKey = format(startOfWeek(d, { weekStartsOn }), 'yyyy-MM-dd');
      if (!groups[weekKey]) {
        const start = startOfWeek(d, { weekStartsOn });
        groups[weekKey] = { label: `${format(start, 'MMM d')} \u2013 ${format(addDays(start, 6), 'MMM d yyyy')}`, items: [] };
      }
      groups[weekKey].items.push(r);
    });
    const currentWeekKey = format(startOfWeek(today, { weekStartsOn }), 'yyyy-MM-dd');
    if (!groups[currentWeekKey]) {
      const start = startOfWeek(today, { weekStartsOn });
      groups[currentWeekKey] = { label: `${format(start, 'MMM d')} \u2013 ${format(addDays(start, 6), 'MMM d yyyy')}`, items: [] };
    }
    Object.values(groups).forEach(g => {
      g.items.sort((a, b) => {
        return daysSorting === 'chrono'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date);
      });
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records, daysSorting, gamificationStats?.weeklyResetDay]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      return daysSorting === 'chrono'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    });
  }, [records, daysSorting]);

  const safeParse = (s: string | null | undefined) => {
    try { return s ? LexoRank.parse(s) : LexoRank.middle(); } catch { return LexoRank.middle(); }
  };

  const addMasterTask = async (type: PropertyType = 'habit') => {
    if (!user) return;
    const id = `mtask_${Date.now()}`;
    const sortOrder = masterTasks.length > 0 ? safeParse(masterTasks[masterTasks.length - 1].sortOrder).genNext().toString() : LexoRank.middle().toString();
    
    let defaultName = 'New Task';
    if (type === 'notes') defaultName = 'Quick Notes';
    else if (type === 'counter') defaultName = 'Progress Counter';
    else if (type === 'toggle_list') defaultName = 'New Group';
    else if (type === 'task_counter') defaultName = 'New Task Counter';

    await setDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', id), { id, name: defaultName, sortOrder, type, period: 'daily' });
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
    recordData: Record<string, boolean | number>,
    currentPoints: number,
    stats: any,
    todayStr: string
  ) => {
    const activeHabits = masterTasks.filter(t => t.type === 'habit' && (!t.period || t.period === 'daily'));
    if (activeHabits.length === 0) return { points: currentPoints, bonusAwarded: false, announcement: '' };
    
    const allCompleted = activeHabits.every(t => !!recordData[t.id]);
    const bonusPointsAmount = stats.allHabitsBonus ?? 50;
    
    const record = records.find(r => r.id === recordId);
    const wasBonusAwarded = !!record?.allHabitsBonusAwarded;
    
    let finalPoints = currentPoints;
    let nextBonusAwarded = wasBonusAwarded;
    let announcement = '';
    
    if (allCompleted && !wasBonusAwarded) {
      finalPoints += bonusPointsAmount;
      nextBonusAwarded = true;
      if (bonusPointsAmount > 0) {
        announcement = `🌟 All Daily Habits Completed Bonus! +${bonusPointsAmount} pts`;
      }
    } else if (!allCompleted && wasBonusAwarded) {
      finalPoints -= bonusPointsAmount;
      nextBonusAwarded = false;
      if (bonusPointsAmount > 0) {
        announcement = `All Daily Habits Bonus canceled (-${bonusPointsAmount} pts)`;
      }
    }
    
    return { points: finalPoints, bonusAwarded: nextBonusAwarded, announcement };
  };

  const checkSevenDayPerfectWeekBonus = async (
    taskId: string,
    recordDate: string,
    nextRecordData: Record<string, boolean | number>,
    currentPoints: number,
    stats: any
  ) => {
    const task = masterTasks.find(t => t.id === taskId);
    if (!task || !task.sevenDayBonusPoints || task.sevenDayBonusPoints <= 0) {
      return { points: currentPoints, announcement: '' };
    }

    const resetDay = stats.weeklyResetDay ?? 1;
    const cardDate = parseISO(recordDate);
    const startOfWeekObj = getStartOfWeekDate(cardDate, resetDay);
    const weekStr = format(startOfWeekObj, 'yyyy-MM-dd');
    const weeklyRecordId = `rec_week_${weekStr}`;
    const weeklyRecordRef = doc(db, 'users', user!.uid, 'pages', pageId, 'weekly_records', weeklyRecordId);
    
    // Fetch current awarded status
    const weeklyRecordSnap = await getDoc(weeklyRecordRef);
    let perfectAttendanceAwarded: Record<string, boolean> = {};
    if (weeklyRecordSnap.exists()) {
      perfectAttendanceAwarded = weeklyRecordSnap.data()?.perfectAttendanceAwarded || {};
    }

    const sevenDayBonus = task.sevenDayBonusPoints;

    // Count completions of taskId for this week
    const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeekObj, i), 'yyyy-MM-dd'));
    let completionsCount = 0;
    weekDays.forEach(dayStr => {
      if (dayStr === recordDate) {
        if (nextRecordData[taskId] === true) {
          completionsCount++;
        }
      } else {
        const dayRecord = records.find(r => r.date === dayStr);
        if (dayRecord?.data?.[taskId] === true) {
          completionsCount++;
        }
      }
    });

    let perfectAttendanceUpdated = { ...perfectAttendanceAwarded };
    let finalPoints = currentPoints;
    let announcement = '';

    const wasAwarded = !!perfectAttendanceAwarded[taskId];
    const isEligible = completionsCount === 7;

    if (isEligible && !wasAwarded) {
      finalPoints += sevenDayBonus;
      perfectAttendanceUpdated[taskId] = true;
      announcement = `✨ Perfect Attendance Bonus for "${task.name}"! +${sevenDayBonus} pts!`;
      await setDoc(weeklyRecordRef, { perfectAttendanceAwarded: perfectAttendanceUpdated }, { merge: true });
    } else if (!isEligible && wasAwarded) {
      finalPoints -= sevenDayBonus;
      perfectAttendanceUpdated[taskId] = false;
      announcement = `Perfect Attendance for "${task.name}" canceled (-${sevenDayBonus} pts)`;
      await setDoc(weeklyRecordRef, { perfectAttendanceAwarded: perfectAttendanceUpdated }, { merge: true });
    }

    return { points: finalPoints, announcement };
  };

  const toggleCompletion = async (recordId: string, taskId: string, current: boolean) => {
    if (!user) return;
    const task = masterTasks.find(t => t.id === taskId);
    if (task && task.rewardMode === 'subtasks_separately' && task.autoTickMode !== 'manual') {
      showPointAnnouncement('Action not applicable', 0);
      return;
    }
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
        let basePoints = task?.pointsValue ?? 10;
        if (task?.rewardMode === 'subtasks_separately' && task?.bonusRequirement === 'main_task') {
           const completedSubs = task.subTasks ? task.subTasks.filter((s: any) => !!recordData[`${taskId}_${s.id}`]).length : 0;
           if (completedSubs === 0) {
             basePoints = 0;
           }
        }
        const multiplier = stats.streakMultiplierActive === true ? (newMultiplier || 1.0) : 1.0;
        const pointsChange = Math.round(basePoints * multiplier);
        
        let newPoints = stats.points;
        let pointsEarnedToday = stats.pointsEarnedToday || 0;
        
        if (stats.lastPointGainDate !== todayStr) {
          pointsEarnedToday = 0; // Reset cap for new day
        }
        
        const DAILY_CAP = stats.dailyPointCap ?? 200;
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
        const { points: finalPoints, bonusAwarded, announcement: allHabitsBonusAnnouncement } = evaluateAllHabitsBonus(recordId, nextRecordData, newPoints, stats, todayStr);
        
        // Check 7-Day Perfect Attendance Bonus
        const { points: pointsAfterWeekly, announcement: weeklyBonusAnnouncement } = await checkSevenDayPerfectWeekBonus(taskId, record.date, nextRecordData, finalPoints, stats);

        await updateDoc(recordRef, { 
          data: nextRecordData,
          allHabitsBonusAwarded: bonusAwarded
        });
        
        let currentST = stats.currentStreak ?? 0;
        let longestST = stats.longestStreak ?? 0;
        let lastActive = stats.lastActiveDate || "";
        let streakExtended = false;

        const targetTasks = stats.streakTargetTasks ?? 1;
        const countCompletedToday = masterTasks.filter(t => t.type === 'habit' && (!t.period || t.period === 'daily') && !!nextRecordData[t.id]).length;
        const reachedStreakThreshold = countCompletedToday >= targetTasks;

        if (reachedStreakThreshold) {
          if (lastActive !== todayStr) {
            currentST += 1;
            if (currentST > longestST) {
              longestST = currentST;
            }
            lastActive = todayStr;
            streakExtended = true;
          }
          if (isCompleted) {
            playDing();
          }
        } else {
          if (lastActive === todayStr) {
            currentST = Math.max(0, currentST - 1);
            lastActive = stats.lastActiveDateBeforeToday || "";
          }
        }

        const statsUpdates: any = { 
          points: pointsAfterWeekly,
          pointsEarnedToday,
          lastPointGainDate: todayStr,
          debt: pointsAfterWeekly < 0,
          taskStreaks,
          currentStreak: currentST,
          longestStreak: longestST,
          lastActiveDate: lastActive,
          lastActiveDateBeforeToday: reachedStreakThreshold && lastActive === todayStr ? (stats.lastActiveDateBeforeToday || stats.lastActiveDate || "") : (stats.lastActiveDateBeforeToday || "")
        };

        await updateDoc(statsRef, statsUpdates);

        if (streakExtended) {
          playAscendingFanfare();
          showToast(`🔥 Streak Extended! ${currentST} Days!`, "success");
        }

        if (allHabitsBonusAnnouncement) {
          showToast(allHabitsBonusAnnouncement, "success");
        }

        if (weeklyBonusAnnouncement) {
          showToast(weeklyBonusAnnouncement, "success");
        }

        if (isCompleted) {
          showPointAnnouncement(actualGain > 0 ? `+${actualGain} pts` : 'Daily cap reached', actualGain);
        } else {
          showPointAnnouncement(`-${pointsChange} pts canceled`, -pointsChange);
        }
      }
    } catch (err) {
      console.warn("Gamification error:", err);
    }
  };

  const toggleWeeklyCompletion = async (recordDateStr: string, taskId: string, current: boolean) => {
    if (!user) return;
    const task = masterTasks.find(t => t.id === taskId);
    if (!task) return;
    const isCompleted = !current;

    const resetDay = gamificationStats?.weeklyResetDay ?? 1;
    const cardDate = parseISO(recordDateStr);
    const startOfWeekObj = getStartOfWeekDate(cardDate, resetDay);
    const weekStr = format(startOfWeekObj, 'yyyy-MM-dd');
    const weeklyRecordId = `rec_week_${weekStr}`;

    const weeklyRecordRef = doc(db, 'users', user.uid, 'pages', pageId, 'weekly_records', weeklyRecordId);
    const snap = await getDoc(weeklyRecordRef);
    
    let weeklyRecordData: Record<string, boolean | number> = {};
    if (snap.exists()) {
      weeklyRecordData = snap.data().data || {};
    } else {
      await setDoc(weeklyRecordRef, { id: weeklyRecordId, date: weekStr, data: {} });
    }

    const nextWeeklyRecordData = { ...weeklyRecordData, [taskId]: isCompleted };

    try {
      await setDoc(weeklyRecordRef, { id: weeklyRecordId, date: weekStr, data: nextWeeklyRecordData }, { merge: true });

      const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
      const statsSnap = await getDoc(statsRef);
      if (statsSnap.exists()) {
        const stats = statsSnap.data() as any;
        const basePoints = task.pointsValue ?? 10;
        const multiplier = stats.streakMultiplierActive === true ? (stats.streakMultiplier ?? 1.0) : 1.0;
        const pointsChange = Math.round(basePoints * multiplier);

        let newPoints = stats.points;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        let pointsEarnedToday = stats.pointsEarnedToday || 0;
        if (stats.lastPointGainDate !== todayStr) {
          pointsEarnedToday = 0;
        }

        const DAILY_CAP = stats.dailyPointCap ?? 200;
        let actualGain = pointsChange;

        if (isCompleted) {
          if (pointsEarnedToday + actualGain > DAILY_CAP) {
            actualGain = Math.max(0, DAILY_CAP - pointsEarnedToday);
          }
          newPoints += actualGain;
          pointsEarnedToday += actualGain;
          playDing();
          showPointAnnouncement(actualGain > 0 ? `+${actualGain} pts` : 'Daily cap reached', actualGain);
        } else {
          newPoints = stats.points - pointsChange;
          pointsEarnedToday = Math.max(0, pointsEarnedToday - pointsChange);
          showPointAnnouncement(`-${pointsChange} pts canceled`, -pointsChange);
        }

        await updateDoc(statsRef, {
          points: newPoints,
          pointsEarnedToday,
          lastPointGainDate: todayStr,
          debt: newPoints < 0
        });
      }
    } catch (err) {
      console.warn("Weekly Gamification error:", err);
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
    const multiplier = stats.streakMultiplierActive === true ? (currentTaskStreak.multiplier || 1.0) : 1.0;
    
    let pointsGained = 0;
    let mainTaskBonusDelta = 0;
    
    // A. Reward Mode points for this sub-task
    if (task.rewardMode === 'subtasks_separately') {
      const subTaskObj = task.subTasks?.find(s => s.id === subId);
      const subTaskBase = subTaskObj?.points ?? 2;
      const subTaskPointsChange = Math.round(subTaskBase * multiplier);
      pointsGained += isCompleted ? subTaskPointsChange : -subTaskPointsChange;
    }
    
    // B. 100% Sub-tasks Completed Bonus and auto-complete checks
    if (task.subTasks && task.subTasks.length > 0) {
      const totalSubs = task.subTasks.length;
      const prevCompletedCount = task.subTasks.filter(s => !!recordData[`${taskId}_${s.id}`]).length;
      const nextCompletedCount = task.subTasks.filter(s => !!nextRecordData[`${taskId}_${s.id}`]).length;
      
      const wasAllComplete = prevCompletedCount === totalSubs;
      const isAllComplete = nextCompletedCount === totalSubs;
      const reqAll = task.bonusRequirement !== 'main_task';
      
      if (reqAll && isAllComplete && !wasAllComplete) {
        const bonusBase = task.rewardMode === 'subtasks_separately'
          ? (task.pointsValue ?? 10)
          : (task.bonusPoints ?? task.pointsValue ?? 5);
        mainTaskBonusDelta = Math.round(bonusBase * multiplier);
        pointsGained += mainTaskBonusDelta;
      } else if (reqAll && !isAllComplete && wasAllComplete) {
        const bonusBase = task.rewardMode === 'subtasks_separately'
          ? (task.pointsValue ?? 10)
          : (task.bonusPoints ?? task.pointsValue ?? 5);
        mainTaskBonusDelta = -Math.round(bonusBase * multiplier);
        pointsGained += mainTaskBonusDelta;
      }
      
      // C. Auto-Tick Main Task
      if (task.autoTickMode === 'any') {
        const nextShouldBeComplete = nextCompletedCount > 0;
        const currentMainComplete = !!recordData[taskId];
        
        if (nextShouldBeComplete !== currentMainComplete) {
          nextRecordData[taskId] = nextShouldBeComplete;
          
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
    const DAILY_CAP = stats.dailyPointCap ?? 200;
    let actualGain = pointsGained;
    if (pointsGained > 0) {
      if (pointsEarnedToday + pointsGained > DAILY_CAP) {
        actualGain = Math.max(0, DAILY_CAP - pointsEarnedToday);
      }
    }
    newPoints += actualGain;
    pointsEarnedToday = Math.max(0, pointsEarnedToday + actualGain);
    
    // Check Completed All Habits Daily Bonus
    const { points: finalPoints, bonusAwarded, announcement: allHabitsBonusAnnouncement } = evaluateAllHabitsBonus(recordId, nextRecordData, newPoints, stats, todayStr);
    
    // Check 7-Day Perfect Attendance Bonus
    const { points: pointsAfterWeekly, announcement: weeklyBonusAnnouncement } = await checkSevenDayPerfectWeekBonus(taskId, record.date, nextRecordData, finalPoints, stats);

    let currentST = stats.currentStreak ?? 0;
    let longestST = stats.longestStreak ?? 0;
    let lastActive = stats.lastActiveDate || "";
    let streakExtended = false;

    const targetTasks = stats.streakTargetTasks ?? 1;
    const countCompletedToday = masterTasks.filter(t => t.type === 'habit' && (!t.period || t.period === 'daily') && !!nextRecordData[t.id]).length;
    const reachedStreakThreshold = countCompletedToday >= targetTasks;

    if (reachedStreakThreshold) {
      if (lastActive !== todayStr) {
        currentST += 1;
        if (currentST > longestST) {
          longestST = currentST;
        }
        lastActive = todayStr;
        streakExtended = true;
      }
    } else {
      if (lastActive === todayStr) {
        currentST = Math.max(0, currentST - 1);
        lastActive = stats.lastActiveDateBeforeToday || "";
      }
    }

    const statsUpdates: any = {
      points: pointsAfterWeekly,
      pointsEarnedToday,
      lastPointGainDate: todayStr,
      debt: pointsAfterWeekly < 0,
      taskStreaks,
      currentStreak: currentST,
      longestStreak: longestST,
      lastActiveDate: lastActive,
      lastActiveDateBeforeToday: reachedStreakThreshold && lastActive === todayStr ? (stats.lastActiveDateBeforeToday || stats.lastActiveDate || "") : (stats.lastActiveDateBeforeToday || "")
    };

    // Save all updates to Firestore
    await updateDoc(recordRef, { 
      data: nextRecordData,
      allHabitsBonusAwarded: bonusAwarded
    });
    
    await updateDoc(statsRef, statsUpdates);

    if (streakExtended) {
      playAscendingFanfare();
      showToast(`🔥 Streak Extended! ${currentST} Days!`, "success");
    }

    if (allHabitsBonusAnnouncement) {
      showToast(allHabitsBonusAnnouncement, "success");
    }

    if (weeklyBonusAnnouncement) {
      showToast(weeklyBonusAnnouncement, "success");
    }

    if (actualGain > 0) {
      showPointAnnouncement(
        mainTaskBonusDelta > 0
          ? `+${actualGain} pts (+${mainTaskBonusDelta} bonus)`
          : `+${actualGain} pts`,
        actualGain
      );
    } else if (actualGain < 0) {
      showPointAnnouncement(mainTaskBonusDelta < 0 ? `${actualGain} pts, main task bonus removed` : `${actualGain} pts canceled`, actualGain);
    } else if (pointsGained > 0) {
      showPointAnnouncement('Daily cap reached', 0);
    }
  };

  const adjustTaskCounter = async (recordId: string, taskId: string, delta: number) => {
    if (!user) return;
    const task = masterTasks.find(t => t.id === taskId);
    if (!task) return;
    const recordRef = doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId);
    const recordSnap = await getDoc(recordRef);
    if (!recordSnap.exists()) return;
    const record = recordSnap.data();
    const recordData = record?.data || {};
    const currentCount = typeof recordData[taskId] === 'number' ? (recordData[taskId] as number) : 0;
    const limit = task.counterLimit || 0;
    if (delta > 0 && limit > 0 && currentCount >= limit) {
      showPointAnnouncement('Daily limit reached!', 0);
      return;
    }
    const nextCount = Math.max(0, currentCount + delta);
    const nextRecordData = { ...recordData, [taskId]: nextCount };
    await updateDoc(recordRef, { data: nextRecordData });
    const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
    const statsSnap = await getDoc(statsRef);
    if (!statsSnap.exists()) return;
    const stats = statsSnap.data() as any;
    const pointsPerCount = task.counterPoints ?? 5;
    const bonus = task.counterBonusPoints ?? 0;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isFirstToday = currentCount === 0 && delta > 0;
    let earned = pointsPerCount * delta;
    if (isFirstToday && bonus !== 0) earned += bonus;
    const DAILY_CAP = stats.dailyPointCap ?? 200;
    let pointsEarnedToday = stats.lastPointGainDate === todayStr ? (stats.pointsEarnedToday || 0) : 0;
    let actualEarned = earned;
    if (earned > 0 && pointsEarnedToday + earned > DAILY_CAP) {
      actualEarned = Math.max(0, DAILY_CAP - pointsEarnedToday);
    }
    const newPoints = stats.points + actualEarned;
    pointsEarnedToday = Math.max(0, pointsEarnedToday + actualEarned);
    await updateDoc(statsRef, { points: newPoints, pointsEarnedToday, lastPointGainDate: todayStr, debt: newPoints < 0 });
    if (actualEarned === 0 && delta > 0) {
      showPointAnnouncement('Daily cap reached', 0);
    } else if (actualEarned > 0) {
      const bonusPart = isFirstToday && bonus > 0 ? ` (+${bonus} bonus)` : '';
      showPointAnnouncement(`+${actualEarned} pts${bonusPart}`, actualEarned);
    } else if (actualEarned < 0) {
      showPointAnnouncement(`${actualEarned} pts`, actualEarned);
    }
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
    const isInsurance = item.name.toLowerCase().includes('streak insurance');
    const actualCost = item.cost;
    const maxLimit = isInsurance ? (item.maxLimit ?? 3) : 9999;

    if (isInsurance) {
      const existingInsurance = inventory.find(i => i.name.toLowerCase().includes('streak insurance'));
      const currentQty = existingInsurance ? existingInsurance.quantity : 0;
      if (currentQty >= maxLimit) {
        showToast(`You cannot hold more than ${maxLimit} Streak Insurance!`, 'error');
        return;
      }
    }

    if (gamificationStats.debt || gamificationStats.points < actualCost) {
      showToast('Not enough points or in Debt Mode!', 'error');
      return;
    }

    customConfirm({
      title: `Purchase ${item.name}?`,
      message: `This will cost ${actualCost} points.`,
      confirmLabel: 'Buy',
      onConfirm: async () => {
        const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
        await updateDoc(statsRef, { points: gamificationStats.points - actualCost });

        const invRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'inventory');
        const existingItem = inventory.find(i => i.id === item.id);
        
        let newItems = [...inventory];
        if (existingItem) {
          newItems = newItems.map(i => i.id === item.id ? {
            ...i,
            quantity: i.quantity + 1,
            costPurchased: actualCost,
            durationHours: item.durationHours || i.durationHours,
            durationValue: item.durationValue ?? i.durationValue,
            durationUnit: item.durationUnit ?? i.durationUnit
          } : i);
        } else {
          newItems.push({
            id: item.id,
            name: item.name,
            type: item.type,
            quantity: 1,
            costPurchased: actualCost,
            durationHours: item.durationHours || 0,
            durationValue: item.durationValue,
            durationUnit: item.durationUnit
          });
        }
        
        await updateDoc(invRef, { items: newItems });

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const spendingRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', `spending_${todayStr}`);
        const spendingSnap = await getDoc(spendingRef);
        const spendingItems = spendingSnap.exists() ? (spendingSnap.data().items || []) : [];
        const spendingItemId = `${item.id}_${Date.now()}`;
        
        await setDoc(spendingRef, {
          date: todayStr,
          items: [
            ...spendingItems,
            {
              id: spendingItemId,
              itemId: item.id,
              name: item.name,
              type: item.type,
              cost: actualCost,
              purchasedAt: new Date().toISOString()
            }
          ]
        });

        // Add to purchase history collection
        await addDoc(collection(db, 'users', user.uid, 'pages', pageId, 'purchase_log'), {
          itemId: item.id,
          spendingItemId,
          name: item.name,
          type: item.type,
          cost: actualCost,
          purchasedAt: new Date().toISOString(),
          reverted: false
        });

        showToast(`${item.name} purchased!`, 'success');
      }
    });
  };

  const handleSpendingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !gamificationStats) return;
    if (spendingPoints <= 0) {
      showToast('Please enter a positive point amount.', 'error');
      return;
    }
    if (!spendingNote.trim()) {
      showToast('Please enter a description for what you bought.', 'error');
      return;
    }
    if (gamificationStats.points < spendingPoints) {
      showToast('Insufficient points!', 'error');
      return;
    }

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const spendingRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', `spending_${todayStr}`);
      const spendingSnap = await getDoc(spendingRef);
      const spendingItems = spendingSnap.exists() ? (spendingSnap.data().items || []) : [];
      
      const spendingItemId = `manual_${Date.now()}`;
      const newSpendingItem = {
        id: spendingItemId,
        itemId: 'manual',
        name: spendingNote,
        type: 'spending',
        cost: spendingPoints,
        purchasedAt: new Date().toISOString()
      };

      await setDoc(spendingRef, {
        date: todayStr,
        items: [...spendingItems, newSpendingItem]
      });

      // Deduct points
      const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
      await updateDoc(statsRef, { points: gamificationStats.points - spendingPoints });

      // Add to historic log
      await addDoc(collection(db, 'users', user.uid, 'pages', pageId, 'purchase_log'), {
        itemId: 'manual',
        spendingItemId,
        name: spendingNote,
        type: 'spending',
        cost: spendingPoints,
        purchasedAt: new Date().toISOString(),
        reverted: false
      });

      showToast(`Manual spending of ${spendingPoints} pts logged!`, 'success');
      
      // Cleanup & Close
      setSpendingPoints(0);
      setSpendingNote('');
      setIsSpendingModalOpen(false);
    } catch (err) {
      console.error("Spending save error:", err);
      showToast('Error saving spending.', 'error');
    }
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
      <div className={`w-full flex flex-col bg-[#0a0a0a] ${isPeek ? 'h-full max-h-full overflow-y-auto py-4 px-6' : 'py-4 px-4 md:px-10'}`}>
        {/* Header - Hidden in focused peek mode to save space */}
        {!(isPeek && sidePeekRecordId) && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1a1a1a] w-full overflow-hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 w-screen md:w-auto shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button 
              onClick={() => {
                setIsGamificationOpen(false);
                setIsWeeklyTasksOpen(false);
                setIsTodoOpen(false);
                setIsScheduleOpen(false);
                setIsSettingsOpen(false);
                setSidePeekRecordId(null);
              }} 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${(!isGamificationOpen && !isWeeklyTasksOpen && !isTodoOpen && !isScheduleOpen && !isSettingsOpen) ? 'bg-[#2383e2] text-white shadow-lg shadow-blue-500/10' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-blue-400 border-blue-900/30'}`}
            >
              <CalendarIcon size={14}/> Daily Tasks
            </button>
            <button 
              onClick={() => {
                setIsGamificationOpen(!isGamificationOpen);
                setIsWeeklyTasksOpen(false);
                setIsTodoOpen(false);
                setIsScheduleOpen(false);
                setIsSettingsOpen(false);
              }} 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${isGamificationOpen ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-purple-400 border-purple-900/30'}`}
            >
              <Gamepad2 size={14}/> Gamify
            </button>

            <button 
              onClick={() => {
                setIsTodoOpen(!isTodoOpen);
                setIsGamificationOpen(false);
                setIsWeeklyTasksOpen(false);
                setIsScheduleOpen(false);
                setIsSettingsOpen(false);
              }} 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${isTodoOpen ? 'bg-indigo-600 text-white' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-indigo-400 border-indigo-900/30'}`}
            >
              <Check size={14}/> To-Do
            </button>

            <button 
              onClick={() => {
                setIsScheduleOpen(!isScheduleOpen);
                setIsGamificationOpen(false);
                setIsWeeklyTasksOpen(false);
                setIsTodoOpen(false);
                setIsSettingsOpen(false);
              }} 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${isScheduleOpen ? 'bg-purple-600 text-white' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-purple-400 border-purple-900/30'}`}
            >
              <Timer size={14}/> Schedule
            </button>

            <button 
              onClick={() => {
                router.push('/settings');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${pathname === '/settings' ? 'bg-[#252525] text-white border border-[#444] shadow-md' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-white'}`}
            >
              <Settings size={14}/> Settings
            </button>

            <div className="flex bg-[#111] rounded-lg p-0.5 border border-[#1a1a1a] shrink-0 ml-auto md:ml-4">
              <button onClick={() => setViewMode('table')} className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${viewMode === 'table' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}><TableIcon size={12}/> Table</button>
              <button onClick={() => setViewMode('card')} className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 md:gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${viewMode === 'card' ? 'bg-[#222] text-white' : 'text-gray-500 hover:text-gray-300'}`}><LayoutGrid size={12}/> Card</button>
            </div>
          </div>
        </div>
        )}

        <div className="">
          {isGamificationOpen ? (
            <div className="p-4 bg-[#111] rounded-xl border border-purple-900/30 min-h-[400px]">
               <GamificationDashboard pageId={pageId} onOpenShop={() => setIsShopOpen(true)} />
            </div>
          ) : isWeeklyTasksOpen ? (
            <div className="p-4 md:p-6 bg-[#111] rounded-xl border border-blue-900/30 min-h-[400px]">
               <WeeklyTasksDashboard 
                 pageId={pageId} 
                 masterTasks={masterTasks}
                 weeklyRecords={weeklyRecords}
                 gamificationStats={gamificationStats}
                 onToggleWeeklyCompletion={toggleWeeklyCompletion}
                 onClose={() => setIsWeeklyTasksOpen(false)}
               />
            </div>
          ) : isTodoOpen ? (
            <div className="p-4 md:p-6 bg-[#111] rounded-xl border border-indigo-900/30 min-h-[400px]">
               <TodoDashboard 
                 pageId={pageId}
                 gamificationStats={gamificationStats}
                 showPointAnnouncement={showPointAnnouncement}
                 onClose={() => setIsTodoOpen(false)}
               />
            </div>
          ) : isScheduleOpen ? (
            <ScheduleDashboard 
              pageId={pageId}
              daysSorting={daysSorting}
              weeklyResetDay={gamificationStats?.weeklyResetDay ?? 1}
              onClose={() => setIsScheduleOpen(false)}
            />
          ) : isSettingsOpen ? (
            <div className="p-5 md:p-8 bg-[#111] border border-[#2d2d2d] rounded-xl text-left shadow-xl w-full min-h-[400px]">
              <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-[#2d2d2d]">
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">Settings</h2>
                  <p className="text-[11px] text-gray-500 mt-1">Dashboard tools, display preferences, and gamification rules.</p>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-white bg-[#1a1a1a] hover:bg-[#222] border border-[#2d2d2d] rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X size={14} /> Back to Dashboard
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Dashboard Tools</span>
                  <button onClick={() => { setIsPropertyModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#161616] border border-[#2d2d2d] text-gray-300 rounded-md text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-[#3d3d3d] transition-all cursor-pointer"><Settings2 size={16}/> Manage Properties</button>
                  <button onClick={() => { setIsDefaultCoverModalOpen(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#161616] border border-[#2d2d2d] text-gray-300 rounded-md text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-[#3d3d3d] transition-all cursor-pointer"><ImageIcon size={16}/> Default Card Cover</button>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Counter Format</span>
                  <div className="flex bg-[#161616] rounded-md p-1 border border-[#2d2d2d]">
                    <button onClick={() => setCounterFormat('fraction')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${counterFormat === 'fraction' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>Fraction</button>
                    <button onClick={() => setCounterFormat('percent')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${counterFormat === 'percent' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>Percent</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Text Scaling</span>
                  <div className="flex bg-[#161616] rounded-md p-1 border border-[#2d2d2d]">
                    <button onClick={() => setTextSize('small')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all cursor-pointer ${textSize === 'small' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>A</button>
                    <button onClick={() => setTextSize('medium')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all cursor-pointer ${textSize === 'medium' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>A+</button>
                    <button onClick={() => setTextSize('large')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all cursor-pointer ${textSize === 'large' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>A++</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Long Tasks Display</span>
                  <div className="flex bg-[#161616] rounded-md p-1 border border-[#2d2d2d]">
                    <button onClick={() => setTextTruncateMode('wrap')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${textTruncateMode === 'wrap' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>Wrap</button>
                    <button onClick={() => setTextTruncateMode('truncate')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${textTruncateMode === 'truncate' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>Truncate</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Week Days Order</span>
                  <div className="flex bg-[#161616] rounded-md p-1 border border-[#2d2d2d]">
                    <button onClick={() => setDaysSorting('chrono')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${daysSorting === 'chrono' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>Monday-Sunday</button>
                    <button onClick={() => setDaysSorting('reverse')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${daysSorting === 'reverse' ? 'bg-[#252525] text-blue-400 font-bold' : 'text-gray-500'}`}>Sunday, Sat, Fri...</button>
                  </div>
                </div>

                <div className="space-y-3 border-t border-[#2d2d2d]/50 pt-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">All Habits Daily Bonus</span>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
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

                <div className="space-y-3 border-t border-[#2d2d2d]/50 pt-3">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Weekly Reset Day</span>
                  <div className="flex flex-col gap-1.5 w-fit">
                    <div className="flex items-center gap-3 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2 cursor-pointer hover:border-purple-500/50 transition-all">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Reset On</span>
                      <select
                        className="bg-transparent text-left outline-none text-white text-[10px] font-black uppercase tracking-widest cursor-pointer pr-1"
                        value={gamificationStats?.weeklyResetDay ?? 1}
                        onChange={async (e) => {
                          if (!user) return;
                          const nextVal = parseInt(e.target.value);
                          const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
                          await updateDoc(statsRef, { weeklyResetDay: nextVal });
                        }}
                      >
                        <option value={1} className="bg-[#1e1e1e] text-white">MONDAY</option>
                        <option value={2} className="bg-[#1e1e1e] text-white">TUESDAY</option>
                        <option value={3} className="bg-[#1e1e1e] text-white">WEDNESDAY</option>
                        <option value={4} className="bg-[#1e1e1e] text-white">THURSDAY</option>
                        <option value={5} className="bg-[#1e1e1e] text-white">FRIDAY</option>
                        <option value={6} className="bg-[#1e1e1e] text-white">SATURDAY</option>
                        <option value={0} className="bg-[#1e1e1e] text-white">SUNDAY</option>
                      </select>
                    </div>
                    <span className="text-[9px] text-gray-600 leading-normal block">Decides which day of the week your weekly tasks reset.</span>
                  </div>
                </div>

                <div className="space-y-3 border-t border-[#2d2d2d]/50 pt-3 md:col-span-2">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Gamification Rules</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <SettingsNumberInput label="Point Decay" description="Points lost per missed day." value={gamificationStats?.decayValue ?? 5} onCommit={async (value) => {
                      if (!user) return;
                      await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats'), { decayValue: value });
                    }} />
                    <SettingsNumberInput label="Daily Point Cap" description="Maximum positive points per day." value={gamificationStats?.dailyPointCap ?? 200} onCommit={async (value) => {
                      if (!user) return;
                      await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats'), { dailyPointCap: value });
                    }} />
                    <SettingsNumberInput 
                      label="Streak Target Tasks" 
                      description="Daily tasks needed for streak." 
                      value={gamificationStats?.streakTargetTasks ?? 1} 
                      onCommit={async (value) => {
                        if (!user) return;
                        await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats'), { streakTargetTasks: value });
                      }} 
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Streak Multiplier</span>
                      <select
                        className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                        value={gamificationStats?.streakMultiplierActive ? 'enabled' : 'disabled'}
                        onChange={async (e) => {
                          if (!user) return;
                          await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats'), { streakMultiplierActive: e.target.value === 'enabled' });
                        }}
                      >
                        <option value="disabled">Disabled (Fixed Base Points)</option>
                        <option value="enabled">Enabled (Scales with Streak)</option>
                      </select>
                      <span className="text-[9px] text-gray-600 leading-normal block">Multiply base points by consecutive streak.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isPeek && sidePeekRecordId ? (
            <div className="flex flex-col h-full max-w-2xl mx-auto py-2">
              {records.filter(r => r.id === sidePeekRecordId).map(record => {
                const dateObj = parseISO(record.date);
                const habits = masterTasks.filter(t => t.type === 'habit' && (!t.period || t.period === 'daily'));
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
                      onEditProperties={() => setIsPropertyModalOpen(true)}
                    />
                    <div className="flex flex-col gap-1 border-b border-[#1a1a1a] pb-6 mb-2 text-left relative">
                      <div className="flex justify-between items-start w-full">
                        <div className="flex flex-col gap-1">
                          <span className={`font-black uppercase tracking-[0.3em] ${getDateHeaderClasses()} ${isSameDay(dateObj, new Date()) ? 'text-blue-500' : 'text-gray-600'}`}>
                            {isSameDay(dateObj, new Date()) ? '@Today' : isSameDay(dateObj, subDays(new Date(), 1)) ? '@Yesterday' : `@${format(dateObj, 'EEEE')}`}
                          </span>
                          <h2 className={`font-bold text-white tracking-tight ${textSize === 'large' ? 'text-3xl' : textSize === 'medium' ? 'text-2xl' : 'text-xl'}`}>{format(dateObj, 'MMMM d, yyyy')}</h2>
                        </div>
                        <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-black rounded-lg tracking-wider uppercase flex flex-col items-center shrink-0">
                          <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-widest mb-0.5">Progress</span>
                          <span>{counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-6">
                      {/* Daily Habits Section */}
                      <div className="space-y-1 text-left">
                        <h3 className={`font-black uppercase text-gray-700 tracking-widest mb-4 px-1 ${getSectionTitleClasses()}`}>Daily Habits</h3>
                        <SortableContext items={masterTasks.map(t => `${record.id}::${t.id}`)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-0.5">
                            {masterTasks.filter(t => !t.parentId && (!t.period || t.period === 'daily') && (t.type === 'habit' || t.type === 'toggle_list' || t.type === 'task_counter' || t.type === 'notes')).map(task => (
                                <SortableMasterItem 
                                  key={task.id} 
                                  id={`${record.id}::${task.id}`} 
                                  task={task} 
                                  allTasks={masterTasks}
                                  allPages={allPages}
                                  onUpdateMasterTask={(id: string, updates: any) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', id), updates)}
                                  onUpdateRecordNotes={(taskId: string, text: string) => {
                                    const rRef = doc(db, 'users', user?.uid || '', 'pages', pageId, 'records', record.id);
                                    updateDoc(rRef, { notes: text, [`data.notesMap.${taskId}`]: text });
                                  }}
                                  completed={!!record.data?.[task.id]} 
                                  recordData={record.data || {}}
                                  isPeek={true}
                                  streak={gamificationStats?.taskStreaks?.[task.id]?.streak || 0}
                                  onToggle={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} 
                                  onToggleTask={(targetTaskId: string) => toggleCompletion(record.id, targetTaskId, !!record.data?.[targetTaskId])}
                                  onToggleSubTask={(subId: string, current: boolean) => toggleSubTask(record.id, task.id, subId, current)}
                                  onToggleSubTaskForTask={(targetTaskId: string, subId: string, current: boolean) => toggleSubTask(record.id, targetTaskId, subId, current)}
                                  onAdjustCounter={(delta: number) => adjustTaskCounter(record.id, task.id, delta)}
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
                      </div>

                      <button onClick={() => addMasterTask()} className="flex items-center gap-2 px-2 py-3 text-gray-700 hover:text-gray-400 text-[11px] font-bold uppercase tracking-widest transition-all mt-2 border-t border-[#1a1a1a]/50 w-full">
                        <Plus size={14}/> Add Habit Property
                      </button>
                    </div>

                    <div className="mt-auto" />
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
                        const habits = masterTasks.filter(t => t.type === 'habit' && (!t.period || t.period === 'daily'));
                        const completedCount = habits.filter(h => !!record.data?.[h.id]).length;
                        const totalCount = habits.length;
                        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                        return (
                          <div 
                            key={record.id} 
                            onClick={() => { if (!isPeek) { setSidePeekPageId(pageId); setSidePeekRecordId(record.id); } }}
                            className={`bg-[#1e1e1e] border border-[#2d2d2d] rounded-[8px] flex flex-col hover:border-[#3d3d3d] transition-all group/card relative overflow-hidden h-fit ${!isPeek ? 'min-h-0 md:min-h-[160px]' : 'min-h-[160px]'} shadow-sm ${!isPeek ? 'cursor-pointer' : ''}`}
                          >
                            <div className={`h-24 w-full relative overflow-hidden shrink-0 border-b border-[#1a1a1a] bg-[#161616] group/card-cover ${(!isPeek && !record.coverImage) ? 'hidden md:block' : ''}`}>
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
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPropertyModalOpen(true);
                                }}
                                title="Edit Properties"
                                className="absolute top-2 right-2 z-20 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-md text-gray-300 hover:text-white opacity-0 group-hover/card-cover:opacity-100 group-hover/card:opacity-100 transition-all cursor-pointer shadow-md hover:scale-105"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                            <div className="p-2 pb-1.5 border-b border-[#1a1a1a] bg-[#222]/30 flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <span className={`font-black uppercase tracking-[0.2em] mb-0.5 block ${getDateHeaderClasses()} ${isSameDay(dateObj, new Date()) ? 'text-blue-400' : 'text-gray-600'}`}>
                                   {isSameDay(dateObj, new Date()) ? '@Today' : isSameDay(dateObj, subDays(new Date(), 1)) ? '@Yesterday' : `@${format(dateObj, 'EEEE')}`}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <h3 className={`font-bold text-white tracking-tight leading-none ${getDateValClasses()}`}>{format(dateObj, 'MMM d, yyyy')}</h3>
                                  <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black rounded leading-none shrink-0" title="Progress">
                                    {counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}
                                  </span>
                                </div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: record.id, label: format(dateObj, 'MMM d') }); }} className="opacity-0 group-hover/card:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all shrink-0"><Trash2 size={11}/></button>
                            </div>
                            <div className="p-1 flex-1 flex flex-col">
                              <div className="space-y-2 min-h-[40px]">
                                {/* Daily Tasks in Main Card */}
                                <SortableContext items={masterTasks.map(t => `${record.id}::${t.id}`)} strategy={verticalListSortingStrategy}>
                                  <div className="space-y-0">
                                    {masterTasks.filter(t => !t.parentId && (!t.period || t.period === 'daily') && (t.type === 'habit' || t.type === 'toggle_list' || t.type === 'task_counter' || t.type === 'notes')).map(task => (
                                      <SortableMasterItem 
                                        key={task.id} 
                                        id={`${record.id}::${task.id}`} 
                                        task={task} 
                                        allTasks={masterTasks}
                                        completed={!!record.data?.[task.id]} 
                                        recordData={record.data || {}}
                                        isPeek={false}
                                        allPages={allPages}
                                        onUpdateMasterTask={(id: string, updates: any) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', id), updates)}
                                        onUpdateRecordNotes={(taskId: string, text: string) => {
                                          const rRef = doc(db, 'users', user?.uid || '', 'pages', pageId, 'records', record.id);
                                          updateDoc(rRef, { notes: text, [`data.notesMap.${taskId}`]: text });
                                        }}
                                        streak={gamificationStats?.taskStreaks?.[task.id]?.streak || 0}
                                        onToggle={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} 
                                        onToggleTask={(targetTaskId: string) => toggleCompletion(record.id, targetTaskId, !!record.data?.[targetTaskId])}
                                        onToggleSubTask={(subId: string, current: boolean) => toggleSubTask(record.id, task.id, subId, current)}
                                        onToggleSubTaskForTask={(targetTaskId: string, subId: string, current: boolean) => toggleSubTask(record.id, targetTaskId, subId, current)}
                                        onAdjustCounter={(delta: number) => adjustTaskCounter(record.id, task.id, delta)}
                                        onContextMenu={(e: any) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, taskId: task.id }); }} 
                                        isEditing={editingTaskId === task.id} 
                                        onRename={(newName: string) => { updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', task.id), { name: newName }); setEditingTaskId(null); }} 
                                        textSizeClass={getTextClasses()} 
                                        checkboxScale={getCheckboxScale()} 
                                        textTruncateMode={textTruncateMode}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </div>
                              <div className="mt-auto" />
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
                     {masterTasks.filter(t => t.type !== 'notes' && t.type !== 'toggle_list' && t.type !== 'counter' && t.period !== 'weekly').map(task => {
                       const streak = gamificationStats?.taskStreaks?.[task.id]?.streak || 0;
                       const isWeekly = task.period === 'weekly';
                       return (
                         <th key={task.id} className="p-4 font-black text-[9px] uppercase tracking-widest text-gray-500 min-w-[120px] text-center">
                           <div className="flex flex-col items-center justify-center gap-0.5">
                             <div className="flex items-center justify-center gap-1">
                               <span>{task.name}</span>
                               {streak > 0 && <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1 rounded shrink-0">🔥 {streak}</span>}
                             </div>
                             {isWeekly && <span className="text-[8px] text-blue-400 font-bold bg-blue-500/10 px-1 rounded shrink-0">Weekly</span>}
                           </div>
                         </th>
                       );
                     })}
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map(record => {
                    const habits = masterTasks.filter(t => t.type === 'habit' && (!t.period || t.period === 'daily'));
                    const completedCount = habits.filter(h => !!record.data?.[h.id]).length;
                    const totalCount = habits.length;
                    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    return (
                      <tr key={record.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors group/row">
                        <td className={`p-4 font-bold text-gray-400 border-r border-[#1a1a1a] ${getTextClasses()}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{format(parseISO(record.date), 'EEE, MMM d')}</span>
                            <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black rounded tracking-wide leading-none shrink-0" title="Progress">
                              {counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}
                            </span>
                          </div>
                        </td>
                        {masterTasks.filter(t => t.type !== 'notes' && t.type !== 'toggle_list' && t.type !== 'counter' && t.period !== 'weekly').map(task => {
                          const isWeekly = task.period === 'weekly';
                          const resetDay = gamificationStats?.weeklyResetDay ?? 1;
                          const startOfWeekObj = getStartOfWeekDate(parseISO(record.date), resetDay);
                          const weekStr = format(startOfWeekObj, 'yyyy-MM-dd');
                          const currentWeeklyRecord = weeklyRecords.find(wr => wr.date === weekStr);
                          const isCompleted = isWeekly ? !!currentWeeklyRecord?.data?.[task.id] : !!record.data?.[task.id];

                          return (
                            <td key={task.id} className="p-2 text-center border-r border-[#1a1a1a]/50">
                              {task.type === 'habit' ? (
                                <div className={getCheckboxScale()}>
                                  <Checkbox 
                                    checked={isCompleted} 
                                    onClick={() => {
                                      if (isWeekly) {
                                        toggleWeeklyCompletion(record.date, task.id, isCompleted);
                                      } else {
                                        toggleCompletion(record.id, task.id, isCompleted);
                                      }
                                    }} 
                                  />
                                </div>
                              ) : task.type === 'task_counter' ? (
                                <span className={`font-black text-purple-400 uppercase ${getTextClasses()}`}>{typeof record.data?.[task.id] === 'number' ? record.data?.[task.id] : 0}</span>
                              ) : '-'}
                            </td>
                          );
                        })}
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
      {gamificationStats && user && (
        <DraggableTestWidget
          points={gamificationStats.points || 0}
          onAdjust={async (delta) => {
            const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
            const nextPoints = (gamificationStats.points || 0) + delta;
            await updateDoc(statsRef, { points: nextPoints, debt: nextPoints < 0 });
            showPointAnnouncement(delta > 0 ? `+${delta} test pts` : `${delta} test pts`, delta);
          }}
        />
      )}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {announcements.map(a => (
          <div key={a.id} className={`px-4 py-3 rounded-lg border shadow-2xl text-[12px] font-black uppercase tracking-wider animate-fade-in ${(a.delta < 0 || a.text.toLowerCase().includes('not applicable')) ? 'bg-red-500/15 border-red-500/30 text-red-300' : a.delta > 0 ? 'bg-green-500/15 border-green-500/30 text-green-300' : 'bg-[#1a1a1a] border-[#2d2d2d] text-gray-300'}`}>
            {a.text}
          </div>
        ))}
      </div>
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
            <button onClick={() => addMasterTask('task_counter')} className="flex-1 py-2.5 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-400 hover:text-white hover:border-[#3d3d3d] transition-all"><Hash size={16}/> <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider">Task Counter</span></button>
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
              {/* Spending Entry Hook */}
              <button 
                onClick={() => setIsSpendingModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 hover:text-yellow-400 border border-yellow-500/25 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-yellow-500/5 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Receipt size={14} className="shrink-0 animate-pulse text-yellow-500" /> Spending
              </button>

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
                    const nameLower = item.name.toLowerCase();
                    const isSpecialItem = nameLower.includes('streak insurance') || nameLower.includes('holiday pass');
                    const icon = 
                      isSpecialItem ? <Package size={20} className="text-amber-400" /> :
                      item.type === 'buff' ? <Shield size={20} className="text-blue-400" /> :
                      item.type === 'timer' ? <Timer size={20} className="text-green-400" /> :
                      item.type === 'note' ? <Sparkles size={20} className="text-purple-400" /> :
                      <Package size={20} className="text-orange-400" />;

                    return (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-[#111] border border-[#2d2d2d] rounded-xl hover:border-purple-500/30 transition-all group relative">
                        <div className="p-3 bg-[#1a1a1a] rounded-lg group-hover:scale-105 transition-transform shrink-0">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-gray-200 truncate">{item.name}</h3>
                            <span className="text-[8px] font-black uppercase tracking-wider text-gray-600 bg-[#1a1a1a] px-1 py-0.2 rounded border border-[#2d2d2d]">{isSpecialItem ? 'item' : item.type}</span>
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
                            {item.name.toLowerCase().includes('streak insurance') ? (gamificationStats?.streakInsuranceCost ?? 500) : item.cost} <span className="opacity-70 text-[10px]">pts</span>
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

      {/* Spending Form Modal */}
      <Modal 
        isOpen={isSpendingModalOpen} 
        onClose={() => setIsSpendingModalOpen(false)} 
        title="Log Spending" 
        maxWidth="420px"
      >
        <form onSubmit={handleSpendingSubmit} className="p-5 space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Points Spent</label>
            <input 
              type="number"
              required
              min={1}
              value={spendingPoints || ''}
              onChange={(e) => setSpendingPoints(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm font-bold text-gray-200 outline-none focus:border-yellow-500/50 transition-colors"
              placeholder="e.g. 50"
              onWheel={(e) => e.currentTarget.blur()}
            />
            <span className="text-[9px] text-gray-500 block mt-1">Available balance: {(gamificationStats?.points || 0).toLocaleString()} pts</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Bought For (Note)</label>
            <textarea
              required
              rows={3}
              value={spendingNote}
              onChange={(e) => setSpendingNote(e.target.value)}
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm font-medium text-gray-200 outline-none focus:border-yellow-500/50 transition-colors resize-none"
              placeholder="What did you buy? e.g. Spent 1 hour watching YouTube"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2d2d2d]/30">
            <button 
              type="button" 
              onClick={() => setIsSpendingModalOpen(false)}
              className="px-4 py-2 bg-[#222] border border-[#333] hover:bg-[#2e2e2e] text-gray-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] cursor-pointer"
            >
              Log Purchase
            </button>
          </div>
        </form>
      </Modal>
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

// Mirror helper to measure coordinates of cursor inside a textarea element
const getTextareaCaretAddress = (textarea: HTMLTextAreaElement, position: number) => {
  try {
    const style = window.getComputedStyle(textarea);
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = textarea.clientWidth + 'px';
    div.style.font = style.font;
    div.style.fontFamily = style.fontFamily;
    div.style.fontSize = style.fontSize;
    div.style.lineHeight = style.lineHeight;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.boxSizing = style.boxSizing;
    
    div.textContent = textarea.value.slice(0, position);
    
    const span = document.createElement('span');
    span.textContent = '@';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const textareaRect = textarea.getBoundingClientRect();
    const top = textareaRect.top + span.offsetTop - textarea.scrollTop;
    const left = textareaRect.left + span.offsetLeft - textarea.scrollLeft;
    document.body.removeChild(div);
    
    return { top, left };
  } catch {
    const textareaRect = textarea.getBoundingClientRect();
    return {
      top: textareaRect.top + 20,
      left: textareaRect.left + 20
    };
  }
};

function SortableMasterItem(props: any) {
  const { 
    id, 
    task, 
    allTasks,
    completed, 
    onToggle, 
    onToggleTask,
    onToggleSubTask, 
    onToggleSubTaskForTask,
    onAdjustCounter,
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
  const [mentionState, setMentionState] = useState<{
    isOpen: boolean;
    textBeforeMention: string;
    searchInput: string;
    cursorPosition: number;
    textarea: HTMLTextAreaElement;
    coords?: { top: number; left: number };
  } | null>(null);

  // Close mention dropdown when clicked elsewhere
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.mention-dropdown-container')) {
        return;
      }
      setMentionState(null);
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, []);
  
  // Persist expanded state in local storage keyed by task.id
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`subtasks_expanded_${task.id}`);
      return saved === 'true';
    }
    return false;
  });

  // Sync expanded state across all days in the week view
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.taskId === task.id) {
        setIsExpanded(customEvent.detail.isExpanded);
      }
    };
    window.addEventListener('toggle-list-expanded-changed', handleSync);
    return () => {
      window.removeEventListener('toggle-list-expanded-changed', handleSync);
    };
  }, [task.id]);

  const toggleExpanded = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    localStorage.setItem(`subtasks_expanded_${task.id}`, String(nextState));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toggle-list-expanded-changed', {
        detail: { taskId: task.id, isExpanded: nextState }
      }));
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);
  
  if (task.type === 'toggle_list') {
    const children = (allTasks || []).filter((t: any) => t.parentId === task.id && (!t.period || t.period === 'daily') && (t.type === 'habit' || t.type === 'notes'));
    const recordId = id.split('::')[0];
    const completionChildren = children.filter((child: any) => child.type === 'habit' && (!child.period || child.period === 'daily'));
    const completedChildren = completionChildren.filter((child: any) => !!recordData?.[child.id]).length;

    // Scale the toggle header label proportionally with the user's text size setting
    const labelSizeClass = textSizeClass.includes('text-[18px]')
      ? 'text-[11px]'
      : textSizeClass.includes('text-[15px]')
      ? 'text-[10px]'
      : 'text-[9px]';

    const labelColor = task.labelColor || '#4b5563'; // default gray-600
    const labelFontWeight = task.labelBold ? 'font-black' : 'font-semibold';

    return (
      <div ref={setNodeRef} style={style} className="flex flex-col mt-3 mb-0.5">
        {/* Section divider header */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
          onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e); }}
          className="flex items-center gap-1.5 w-full group/toggle py-1 px-1 rounded hover:bg-[#1a1a1a] transition-colors"
        >
          <ChevronDown
            size={11}
            className={`transition-transform duration-200 shrink-0 ${!isExpanded ? '-rotate-90' : ''}`}
            style={{ color: labelColor }}
          />
          {isEditing ? (
            <input
              ref={inputRef}
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={() => onRename(tempName)}
              onKeyDown={e => { if (e.key === 'Enter') onRename(tempName); }}
              onClick={e => e.stopPropagation()}
              className={`bg-transparent outline-none border-b border-purple-500/60 uppercase tracking-[0.2em] flex-1 min-w-0 ${labelSizeClass} ${labelFontWeight}`}
              style={{ color: labelColor }}
            />
          ) : (
            <span
              className={`uppercase tracking-[0.2em] transition-colors flex-1 text-left min-w-0 ${labelSizeClass} ${labelFontWeight} ${textTruncateMode === 'truncate' ? 'truncate' : ''}`}
              style={{ color: labelColor }}
            >
              {task.name}
            </span>
          )}
          {completionChildren.length > 0 && (
            <span className="text-[9px] font-black tracking-wider shrink-0" style={{ color: labelColor }}>
              {completedChildren}/{completionChildren.length}
            </span>
          )}
        </button>

        {isExpanded && children.length > 0 && (
          <div className="relative mt-0.5 space-y-0.5">
            {/* Absolute Bolder Vertical Line */}
            <div 
              className="absolute left-[4px] top-0 bottom-0 w-[2px] pointer-events-none rounded"
              style={{ backgroundColor: labelColor }}
            />
            <div className="pl-0">
              <SortableContext items={children.map((c: any) => `${recordId}::${c.id}`)} strategy={verticalListSortingStrategy}>
                {children.map((child: any) => (
                  <SortableMasterItem
                    key={child.id}
                    {...props}
                    id={`${recordId}::${child.id}`}
                    task={child}
                    completed={!!recordData?.[child.id]}
                    onToggle={() => onToggleTask?.(child.id)}
                    onToggleSubTask={(subId: string, current: boolean) => onToggleSubTaskForTask?.(child.id, subId, current)}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        )}

        {isExpanded && children.length === 0 && (
          <div className="relative py-1 text-[10px] text-gray-700 italic pl-6">
            {/* Absolute Bolder Vertical Line */}
            <div 
              className="absolute left-[4px] top-0 bottom-0 w-[2px] pointer-events-none rounded"
              style={{ backgroundColor: labelColor }}
            />
            Empty group
          </div>
        )}
      </div>
    );
  }

  if (task.type === 'task_counter') {
    const currentCount = typeof recordData?.[task.id] === 'number' ? recordData[task.id] : 0;
    const limit = task.counterLimit || 0;

    return (
      <div ref={isPeek ? setNodeRef : null} style={style} onContextMenu={onContextMenu} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-[#252526] transition-all min-h-[28px] group/item">
        {isPeek && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
            <GripVertical size={10} className="text-gray-800" />
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0 order-1">
          {isPeek && (
            <button onClick={() => onAdjustCounter?.(-1)} disabled={currentCount <= 0} className="w-6 h-6 rounded bg-[#111] border border-[#2d2d2d] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all">
              <Minus size={12} />
            </button>
          )}
          <span className="min-w-10 text-center text-[12px] font-black text-purple-300">
            {currentCount}{limit > 0 ? `/${limit}` : ''}
          </span>
          {isPeek && (
            <button onClick={() => onAdjustCounter?.(1)} disabled={limit > 0 && currentCount >= limit} className="w-6 h-6 rounded bg-[#111] border border-[#2d2d2d] text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all">
              <Plus size={12} />
            </button>
          )}
        </div>
        {isEditing ? (
          <input ref={inputRef} className={`order-2 flex-1 bg-transparent font-medium text-blue-400 outline-none border-b border-blue-500/50 ${textSizeClass}`} value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={() => onRename(tempName)} onKeyDown={(e) => { if (e.key === 'Enter') onRename(tempName); if (e.key === 'Escape') onRename(task.name); }} />
        ) : (
          <span className={`order-2 flex-1 min-w-0 font-medium text-gray-400 ${textTruncateMode === 'truncate' ? 'truncate whitespace-nowrap overflow-hidden' : 'whitespace-normal break-words'} ${textSizeClass}`}>
            {task.name}
          </span>
        )}
      </div>
    );
  }

  if (task.type === 'notes') {
    const isSync = task.notesMode === 'sync';
    const notesContent = isSync 
      ? (task.syncedNoteText || '') 
      : (recordData?.notesMap?.[task.id] ?? (task.parentId ? '' : recordData?.notes) ?? '');

    const handleNotesChange = (text: string) => {
      if (isSync) {
        if (props.onUpdateMasterTask) {
          props.onUpdateMasterTask(task.id, { syncedNoteText: text });
        }
      } else {
        if (props.onUpdateRecordNotes) {
          props.onUpdateRecordNotes(task.id, text);
        }
      }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const textarea = e.target;
      const val = textarea.value;
      const cursor = textarea.selectionStart;
      const textBefore = val.slice(0, cursor);
      const match = textBefore.match(/@([a-zA-Z0-9_\s-]*)$/);
      
      if (match) {
        const queryText = match[1];
        if (queryText.length > 0) {
          setMentionState(null);
          handleNotesChange(val);
          return;
        }
        const hasSpaceImmediately = queryText.startsWith(' ');
        
        // Find if page suggestions exist for this text
        const matches = (props.allPages || []).filter(
          (p: any) => !p.deletedAt && p.title.toLowerCase().includes(queryText.toLowerCase())
        );

        if (!hasSpaceImmediately && matches.length > 0) {
          const coords = getTextareaCaretAddress(textarea, cursor);
          setMentionState({
            isOpen: true,
            textBeforeMention: textBefore.substring(0, textBefore.length - match[0].length),
            searchInput: queryText,
            cursorPosition: cursor,
            textarea: textarea,
            coords
          });
          handleNotesChange(val);
          return;
        }
      }
      setMentionState(null);
      handleNotesChange(val);
    };

    if (isPeek) {
      return (
        <div ref={setNodeRef} style={style} className="flex flex-col mb-3 text-left">
          <div onContextMenu={onContextMenu} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 px-1 py-1 rounded-md hover:bg-[#252526]/50 transition-all min-h-[22px] group/item">
            {isPeek && (
              <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <GripVertical size={10} className="text-gray-800" />
              </div>
            )}
            <StickyNote size={12} className="text-purple-400 shrink-0" />
            
            {isEditing ? (
              <input 
                ref={inputRef} 
                className={`flex-1 bg-transparent font-medium text-blue-400 outline-none border-b border-blue-500/50 ${textSizeClass}`} 
                value={tempName} 
                onChange={(e) => setTempName(e.target.value)} 
                onBlur={() => onRename(tempName)} 
                onKeyDown={(e) => { if (e.key === 'Enter') onRename(tempName); if (e.key === 'Escape') onRename(task.name); }} 
              />
            ) : (
              <span className={`flex-1 min-w-0 font-black text-gray-500 tracking-wider text-[11px] uppercase`}>
                {task.name} <span className="text-[9px] font-medium text-gray-600 lowercase italic">({isSync ? 'sync' : 'separate'})</span>
              </span>
            )}
          </div>

          <div className="pl-5 pr-1 relative w-full mt-1">
            <textarea
              className={`w-full bg-[#111] border border-[#2d2d2d] rounded-lg p-3 text-gray-300 placeholder:text-gray-800 outline-none focus:border-purple-500/50 transition-all min-h-[100px] leading-relaxed resize-y ${textSizeClass}`}
              placeholder="Log note content... Type @ to mention/link another page..."
              value={notesContent}
              onChange={handleTextareaChange}
              onBlur={(e) => {
                if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.mention-dropdown-container')) {
                  return;
                }
                setTimeout(() => setMentionState(null), 250);
              }}
            />

            {mentionState && mentionState.isOpen && mentionState.coords && (() => {
              const { top, left } = mentionState.coords;
              return (
                <div 
                  style={{
                    position: 'fixed',
                    top: `${top}px`,
                    left: `${left}px`,
                    transform: 'translate(12px, -100%)',
                  }}
                  className="mention-dropdown-container z-[999] bg-[#1c1c1e] border border-[#2d2d30] rounded-xl shadow-2xl p-2 w-64 flex flex-col gap-2 text-left"
                  onMouseDown={(e) => {
                    if (!(e.target as HTMLElement).closest('.mention-search-input')) {
                      e.preventDefault();
                    }
                    e.stopPropagation();
                  }}
                >
                  <div className="flex items-center gap-1.5 px-1 py-0.5 border-b border-[#2d2d30] pb-1.5 justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Link to Page</span>
                    <button 
                      type="button"
                      onClick={() => setMentionState(null)}
                      className="p-0.5 hover:bg-white/10 rounded text-gray-500 hover:text-gray-300"
                    >
                      <X size={10} />
                    </button>
                  </div>

                  <div className="px-1">
                    <input
                      type="text"
                      placeholder="Search pages..."
                      className="mention-search-input w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors font-medium opacity-90"
                      value={mentionState.searchInput}
                      onChange={(e) => {
                        setMentionState({
                          ...mentionState,
                          searchInput: e.target.value
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setMentionState(null);
                      }}
                    />
                  </div>

                  <div className="overflow-y-auto max-h-36 space-y-0.5 custom-scrollbar p-0.5">
                    {(props.allPages || [])
                      .filter((p: any) => !p.deletedAt && p.title.toLowerCase().includes(mentionState.searchInput.toLowerCase()))
                      .map((page: any) => {
                        const PageIcon = page.type === 'note' ? FileText : CalendarIcon;
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => {
                              const textarea = mentionState.textarea;
                              const val = textarea.value;
                              const before = val.substring(0, mentionState.cursorPosition - 1);
                              const after = val.substring(mentionState.cursorPosition);
                              const linkText = `[@${page.title}](/page/${page.id}) `;
                              const newValue = before + linkText + after;
                              
                              textarea.value = newValue;
                              handleNotesChange(newValue);
                              setMentionState(null);
                              
                              setTimeout(() => {
                                textarea.focus();
                                const nextCursor = before.length + linkText.length;
                                textarea.setSelectionRange(nextCursor, nextCursor);
                              }, 50);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-purple-500/15 rounded text-left text-gray-300 hover:text-white transition-colors cursor-pointer group"
                          >
                            <PageIcon size={12} className="text-gray-500 group-hover:text-purple-400 shrink-0" />
                            <span className="truncate text-[11.5px] font-semibold">{page.title}</span>
                          </button>
                        );
                      })}
                    {(props.allPages || []).filter((p: any) => !p.deletedAt && p.title.toLowerCase().includes(mentionState.searchInput.toLowerCase())).length === 0 && (
                      <div className="px-2 py-4 text-center text-[10px] text-gray-600">No pages found</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      );
    } else {
      return (
        <div 
          onContextMenu={onContextMenu} 
          onClick={(e) => e.stopPropagation()} 
          className="flex flex-col text-left py-1.5 px-2 bg-[#161616] rounded border border-[#1a1a1a] shadow-inner mb-2 select-text"
        >
          <div className="flex items-center gap-1.5 mb-1 select-none">
            <StickyNote size={11} className="text-purple-400 shrink-0" />
            <span className="font-black text-gray-500 uppercase tracking-wider text-[9px]">
              {task.name} <span className="text-[8px] font-medium text-gray-600 lowercase italic">({isSync ? 'sync' : 'separate'})</span>
            </span>
          </div>
          <div className={`text-gray-400 leading-tight text-[11.5px] px-0.5 line-clamp-3 select-text break-words w-full`}>
            {parseNotesWithLinks(notesContent, props.allPages || [])}
          </div>
        </div>
      );
    }
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
        <div className="ml-[11px] pl-[9px] border-l border-[#2d2d2d]/40 mt-1 space-y-1">
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

export function SortableModalRow({ task, allTasks, onDelete, onRename, onUpdate }: { task: MasterTask; allTasks: MasterTask[]; onDelete: (id: string) => void; onRename: (id: string, name: string) => void; onUpdate?: (id: string, updates: any) => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const Icon = task.type === 'notes' ? StickyNote : task.type === 'counter' ? Activity : task.type === 'toggle_list' ? ChevronDown : task.type === 'task_counter' ? Hash : Check;
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
        {onUpdate && (
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
          {/* Toggle List Appearance Settings */}
          {task.type === 'toggle_list' && (
            <div className="space-y-4 pb-3 border-b border-[#2d2d2d]/50">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Label Color</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Gray', value: '' },
                    { label: 'Purple', value: '#a855f7' },
                    { label: 'Blue', value: '#3b82f6' },
                    { label: 'Cyan', value: '#06b6d4' },
                    { label: 'Green', value: '#22c55e' },
                    { label: 'Yellow', value: '#eab308' },
                    { label: 'Orange', value: '#f97316' },
                    { label: 'Red', value: '#ef4444' },
                    { label: 'Pink', value: '#ec4899' },
                    { label: 'White', value: '#e5e7eb' },
                  ].map(({ label, value }) => {
                    const activeColor = value || '#4b5563';
                    const isActive = (task.labelColor || '') === value;
                    return (
                      <button
                        key={label}
                        title={label}
                        onClick={() => onUpdate(task.id, { labelColor: value || null })}
                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${isActive ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: activeColor }}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Bold Label</span>
                <button
                  onClick={() => onUpdate(task.id, { labelBold: !task.labelBold })}
                  className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                    task.labelBold
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-[#111] border border-[#2d2d2d] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {task.labelBold ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          )}

          {/* Global Property Settings - Parent List (non toggle_list only) */}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                {task.rewardMode === 'subtasks_separately' ? 'Main Task Completion Bonus' : 'Main Task Base Points'}
              </span>
              <input 
                type="number" 
                min={0}
                className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                defaultValue={task.pointsValue ?? 10}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  onUpdate(task.id, { pointsValue: isNaN(val) ? 10 : Math.max(0, val) });
                }}
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

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">7-Day Perfect Week Bonus</span>
              <input 
                type="number" 
                className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                defaultValue={task.sevenDayBonusPoints || 0}
                placeholder="0"
                onBlur={(e) => onUpdate(task.id, { sevenDayBonusPoints: parseInt(e.target.value) || 0 })}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          </div>

          {task.rewardMode === 'subtasks_separately' && (
            <div className="flex flex-col gap-1 border-t border-[#2d2d2d]/50 pt-3">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Main Task Bonus Requirement</span>
              <select
                className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                value={task.bonusRequirement || 'all_subtasks'}
                onChange={(e) => onUpdate(task.id, { bonusRequirement: e.target.value })}
              >
                <option value="all_subtasks">Require all sub-tasks to be completed</option>
                <option value="main_task">Require main task to be completed (with at least 1 sub-task)</option>
              </select>
            </div>
          )}

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
              {(task.subTasks || []).map((sub: any, index: number) => (
                <div key={sub.id} className="flex items-center gap-3 px-3 py-2 bg-[#111] rounded border border-[#2d2d2d] hover:border-[#333] transition-colors">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => {
                        if (index === 0) return;
                        onUpdate(task.id, { subTasks: arrayMove(task.subTasks || [], index, index - 1) });
                      }}
                      disabled={index === 0}
                      className="p-0.5 text-gray-500 hover:text-blue-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move sub-task up"
                    >
                      <ChevronDown size={12} className="rotate-180" />
                    </button>
                    <button
                      onClick={() => {
                        if (index === (task.subTasks || []).length - 1) return;
                        onUpdate(task.id, { subTasks: arrayMove(task.subTasks || [], index, index + 1) });
                      }}
                      disabled={index === (task.subTasks || []).length - 1}
                      className="p-0.5 text-gray-500 hover:text-blue-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move sub-task down"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
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
                        min={0}
                        className="w-14 bg-[#1a1a1a] border border-[#2d2d2d] rounded px-1.5 py-0.5 text-center text-[12px] font-bold text-purple-400 outline-none focus:border-purple-500 transition-colors"
                        defaultValue={sub.points ?? 2}
                        onBlur={(e) => {
                          const parsed = parseInt(e.target.value);
                          const pointsVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
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
          {task.type === 'task_counter' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Points Per Increment</span>
                <input
                  type="number"
                  className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                  defaultValue={task.counterPoints ?? 5}
                  onBlur={(e) => onUpdate(task.id, { counterPoints: parseInt(e.target.value) || 0 })}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">First Increment Bonus</span>
                <input
                  type="number"
                  className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                  defaultValue={task.counterBonusPoints ?? 0}
                  onBlur={(e) => onUpdate(task.id, { counterBonusPoints: parseInt(e.target.value) || 0 })}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Daily Max Limit</span>
                <input
                  type="number"
                  min={0}
                  className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                  defaultValue={task.counterLimit ?? 0}
                  onBlur={(e) => onUpdate(task.id, { counterLimit: Math.max(0, parseInt(e.target.value) || 0) })}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            </div>
          )}

          {task.type === 'notes' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Note Property Mode</span>
                <select
                  className="bg-[#111] border border-[#2d2d2d] rounded px-3 py-2 text-[12.5px] font-medium text-white w-full outline-none focus:border-purple-500 transition-colors"
                  value={task.notesMode || 'separate'}
                  onChange={(e) => onUpdate(task.id, { notesMode: e.target.value })}
                >
                  <option value="separate">Separate (Unique Note per Day)</option>
                  <option value="sync">Sync (Same Note synced everyday)</option>
                </select>
                <span className="text-[9px] text-gray-500 block leading-normal">
                  {task.notesMode === 'sync' 
                    ? "Synced mode allows editing this note on any day's Side Peek or right here in this settings panel." 
                    : "Separate mode gives you a fresh unique note box on each day. (Separate notes can only be edited inside the Side Peek view)"}
                </span>
              </div>

              {task.notesMode === 'sync' && (
                <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d]/50 pt-3">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                    <StickyNote size={12} /> Edit Synced Note Text (Global Setting)
                  </span>
                  <textarea
                    className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg p-3 text-gray-300 placeholder:text-gray-800 outline-none focus:border-purple-500/50 transition-all min-h-[120px] leading-relaxed text-xs resize-y"
                    placeholder="Click and type your synced note message..."
                    value={task.syncedNoteText || ''}
                    onChange={(e) => onUpdate(task.id, { syncedNoteText: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsNumberInput({ label, description, value, onCommit }: { label: string; description: string; value: number; onCommit: (value: number) => void | Promise<void> }) {
  return (
    <div className="bg-[#111] border border-[#2d2d2d] rounded-lg p-3">
      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">{label}</span>
      <input
        type="number"
        className="mt-2 w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded px-3 py-2 text-sm font-bold text-white outline-none focus:border-purple-500"
        defaultValue={value}
        onBlur={(e) => onCommit(parseInt(e.target.value) || 0)}
        onWheel={(e) => e.currentTarget.blur()}
      />
      <span className="text-[9px] text-gray-600 leading-normal block mt-2">{description}</span>
    </div>
  );
}

function DraggableTestWidget({ points, onAdjust }: { points: number; onAdjust: (delta: number) => void | Promise<void> }) {
  const [position, setPosition] = useState({ x: 24, y: 120 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const nextX = Math.max(8, dragRef.current.originX + e.clientX - dragRef.current.startX);
    const nextY = Math.max(8, dragRef.current.originY + e.clientY - dragRef.current.startY);
    setPosition({ x: nextX, y: nextY });
  };

  return (
    <div className="fixed z-[9998] w-[190px] bg-[#151515] border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden" style={{ left: position.x, top: position.y }}>
      <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = null; }} className="cursor-grab active:cursor-grabbing px-3 py-2 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Test Points</span>
        <GripVertical size={14} className="text-purple-400" />
      </div>
      <div className="p-3 space-y-3">
        <div className="text-2xl font-black text-white">{points.toLocaleString()}</div>
        <div className="grid grid-cols-2 gap-2">
          {[-100, -10, 10, 100].map(delta => (
            <button key={delta} onClick={() => onAdjust(delta)} className={`px-2 py-2 rounded text-[11px] font-black transition-all ${delta > 0 ? 'bg-green-500/15 text-green-300 hover:bg-green-500/25' : 'bg-red-500/15 text-red-300 hover:bg-red-500/25'}`}>
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>
      </div>
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
  const [maxLimit, setMaxLimit] = useState<number>(initialItem?.maxLimit || 3);

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name);
      setDescription(initialItem.description);
      setCost(initialItem.cost);
      setType(initialItem.type);
      setDurationValue(initialItem.durationValue || initialItem.durationHours || 24);
      setDurationUnit(initialItem.durationUnit || 'hours');
      setMaxLimit(initialItem.maxLimit || 3);
    } else {
      setName('');
      setDescription('');
      setCost(100);
      setType('buff');
      setDurationValue(24);
      setDurationUnit('hours');
      setMaxLimit(3);
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

        <div className={name.toLowerCase().includes('streak insurance') ? "grid grid-cols-1" : "grid grid-cols-2 gap-4"}>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Cost (Points)</label>
            <input 
              type="number" 
              value={cost} 
              onChange={(e) => setCost(Math.max(1, parseInt(e.target.value) || 0))} 
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50" 
            />
          </div>

          {!name.toLowerCase().includes('streak insurance') && (
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
          )}
        </div>

        {name.toLowerCase().includes('streak insurance') && (
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider block mb-1">Maximum Inventory Cap</label>
            <input 
              type="number" 
              value={maxLimit} 
              onChange={(e) => setMaxLimit(Math.max(1, parseInt(e.target.value) || 1))} 
              className="w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50" 
            />
          </div>
        )}

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
            type="button"
            onClick={onClose} 
            className="px-4 py-2 bg-[#222] text-gray-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={() => {
              if (!name.trim()) return;
              const calculatedHours = durationUnit === 'minutes' ? durationValue / 60 : durationValue;
              const isInsurance = name.toLowerCase().includes('streak insurance');
              onSubmit({ 
                name, 
                description, 
                cost, 
                type: isInsurance ? 'instant' : type, 
                durationHours: calculatedHours,
                durationValue,
                durationUnit,
                maxLimit: isInsurance ? maxLimit : undefined
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
