'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNotification } from '@/context/NotificationContext';
import { playAscendingFanfare, playDing } from '@/lib/sounds';
import { Clock, Plus, Trash2, Edit2, Check, X, Calendar, AlertCircle, Sparkles, Volume2, ArrowRight, GripVertical, ChevronDown } from 'lucide-react';

interface ScheduleBlock {
  id: string;
  title: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  type: 'normal' | 'important';
  color?: string;    // 'emerald' | 'purple' | 'blue' | 'indigo' | 'teal' | 'amber' | 'rose' | 'fuchsia'
  notes?: string;
}

const COLOR_PRESETS = [
  { id: 'emerald', label: 'Emerald', bgClass: 'bg-emerald-500' },
  { id: 'purple', label: 'Purple', bgClass: 'bg-purple-500' },
  { id: 'blue', label: 'Blue', bgClass: 'bg-blue-500' },
  { id: 'indigo', label: 'Indigo', bgClass: 'bg-indigo-500' },
  { id: 'teal', label: 'Teal', bgClass: 'bg-teal-500' },
  { id: 'amber', label: 'Amber', bgClass: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', bgClass: 'bg-rose-500' },
  { id: 'fuchsia', label: 'Fuchsia', bgClass: 'bg-fuchsia-500' },
] as const;

const formatTimeStr = (time24: string, format12h: boolean): string => {
  if (!time24) return '';
  if (!format12h) return time24;
  const [hourStr, minStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return time24;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minStr} ${period}`;
};

function TimePicker({
  value,
  onChange,
  is12Hour,
  label,
  align = 'left'
}: {
  value: string;
  onChange: (val: string) => void;
  is12Hour: boolean;
  label: string;
  align?: 'left' | 'right';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [hour24, min] = value.split(':').map(v => parseInt(v, 10));
  const activeHour24 = isNaN(hour24) ? 6 : hour24;
  const activeMin = isNaN(min) ? 0 : min;

  // Determine active display states
  let displayHour = activeHour24;
  let period: 'AM' | 'PM' = 'AM';
  if (is12Hour) {
    displayHour = activeHour24 % 12 === 0 ? 12 : activeHour24 % 12;
    period = activeHour24 >= 12 ? 'PM' : 'AM';
  }

  const hours = is12Hour 
    ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] 
    : Array.from({ length: 24 }, (_, i) => i);

  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleHourSelect = (h: number) => {
    let newHour24 = h;
    if (is12Hour) {
      if (period === 'PM' && h < 12) newHour24 += 12;
      if (period === 'AM' && h === 12) newHour24 = 0;
    }
    onChange(`${String(newHour24).padStart(2, '0')}:${String(activeMin).padStart(2, '0')}`);
  };

  const handleMinSelect = (m: number) => {
    onChange(`${String(activeHour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const handlePeriodSelect = (p: 'AM' | 'PM') => {
    let newHour24 = activeHour24;
    const current12h = activeHour24 % 12 === 0 ? 12 : activeHour24 % 12;
    if (p === 'PM' && current12h < 12) newHour24 = current12h + 12;
    if (p === 'AM') newHour24 = current12h === 12 ? 0 : current12h;
    onChange(`${String(newHour24).padStart(2, '0')}:${String(activeMin).padStart(2, '0')}`);
  };

  const displayValue = formatTimeStr(value, is12Hour);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#111] border border-[#222] rounded-lg px-2.5 py-2 text-white font-mono font-bold text-xs text-left flex items-center justify-between hover:border-purple-500 hover:bg-[#151515] transition-all cursor-pointer select-none"
      >
        <span>{displayValue}</span>
        <Clock size={11} className="text-gray-500 shrink-0 ml-1.5" />
      </button>

      {isOpen && (
        <div 
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 bg-[#141414] border border-[#2d2d2d] rounded-xl shadow-2xl p-2.5 flex gap-1.5 z-[100] text-xs w-[215px] select-none h-56 animate-fadeIn`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hours Column */}
          <div className="flex-1 flex flex-col min-w-[50px] h-full">
            <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 text-center mb-1 shrink-0">Hr</span>
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded space-y-0.5 pr-0.5">
              {hours.map((h) => {
                const isSelected = is12Hour 
                  ? displayHour === h 
                  : activeHour24 === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={`w-full py-1 text-center font-mono font-black text-[11px] rounded transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-400 hover:bg-[#222] hover:text-white'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutes Column */}
          <div className="flex-1 flex flex-col min-w-[50px] h-full">
            <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 text-center mb-1 shrink-0">Min</span>
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded space-y-0.5 pr-0.5">
              {minutes.map((m) => {
                const isSelected = activeMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinSelect(m)}
                    className={`w-full py-1 text-center font-mono font-black text-[11px] rounded transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-purple-600 text-white' 
                        : 'text-gray-400 hover:bg-[#222] hover:text-white'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AM/PM Column */}
          {is12Hour && (
            <div className="flex flex-col min-w-[45px] border-l border-[#222] pl-1.5 justify-center gap-1.5 shrink-0">
              <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 text-center mb-1">Am/Pm</span>
              {(['AM', 'PM'] as const).map((p) => {
                const isSelected = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodSelect(p)}
                    className={`w-full py-1.5 text-center font-mono font-black text-[11px] rounded transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-purple-600 text-white shadow shadow-purple-600/30' 
                        : 'bg-[#1a1a1a] text-gray-400 border border-[#222] hover:text-white hover:bg-[#222]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayOfWeekPicker({
  value,
  onChange,
  options,
  label
}: {
  value: number;
  onChange: (val: number) => void;
  options: { label: string; value: number }[];
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#111] border border-[#222] rounded-lg px-2.5 py-2 text-white font-bold text-xs text-left flex items-center justify-between hover:border-purple-500 hover:bg-[#151515] transition-all cursor-pointer select-none"
      >
        <span>{selectedOption.label}</span>
        <ChevronDown size={11} className="text-gray-500 shrink-0 ml-1.5" />
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-1 bg-[#141414] border border-[#2d2d2d] rounded-xl shadow-2xl p-1 z-[100] text-xs select-none max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full py-2 px-3 text-left font-black text-[11px] rounded transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-400 hover:bg-[#222] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScheduleDashboard({ 
  pageId, 
  daysSorting = 'chrono',
  weeklyResetDay = 1,
  onClose 
}: { 
  pageId: string; 
  daysSorting?: 'chrono' | 'reverse';
  weeklyResetDay?: number;
  onClose: () => void 
}) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Form error state for custom beautiful validation matching the theme
  const [formError, setFormError] = useState<string | null>(null);

  const [is12Hour, setIs12Hour] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`schedule_time_format_12h_${pageId}`);
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(`schedule_time_format_12h_${pageId}`, String(is12Hour));
  }, [is12Hour, pageId]);

  // Helper to find latest block's end time and set start/end times
  const getLatestBlockTimes = (selectedDay: number, currentBlocks: ScheduleBlock[]) => {
    const dayBlocks = currentBlocks.filter(b => b.dayOfWeek === selectedDay);
    if (dayBlocks.length === 0) {
      return { start: '06:00', end: '07:00' };
    }
    const sorted = [...dayBlocks].sort((a, b) => a.endTime.localeCompare(b.endTime));
    const latestBlock = sorted[sorted.length - 1];
    const start = latestBlock.endTime;
    
    const [hStr, mStr] = start.split(':');
    let hour = parseInt(hStr, 10);
    let min = parseInt(mStr, 10);
    if (isNaN(hour) || isNaN(min)) {
      return { start: '06:00', end: '07:00' };
    }
    
    let endHour = hour + 1;
    let endMin = min;
    if (endHour >= 24) {
      endHour = 23;
      endMin = 59;
    }
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const end = `${pad(endHour)}:${pad(endMin)}`;
    return { start, end };
  };

  const handleAddClick = () => {
    if (!isAddingBlock) {
      const { start, end } = getLatestBlockTimes(dayOfWeek, blocks);
      setStartTime(start);
      setEndTime(end);
      setIsAddingBlock(true);
    } else {
      resetForm();
    }
  };

  // Form states for adding/editing
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(weeklyResetDay);
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('07:00');
  const [type, setType] = useState<'normal' | 'important'>('normal');
  const [color, setColor] = useState<string>('emerald');

  // Currently selected day in mobile/narrow view
  const [activeTabDay, setActiveTabDay] = useState<number>(new Date().getDay());

  // Real-time ticking clock for announcement checking
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDayNum, setCurrentDayNum] = useState<number>(new Date().getDay());

  const DAYS = [
    { label: 'Sunday', short: 'Sun', value: 0 },
    { label: 'Monday', short: 'Mon', value: 1 },
    { label: 'Tuesday', short: 'Tue', value: 2 },
    { label: 'Wednesday', short: 'Wed', value: 3 },
    { label: 'Thursday', short: 'Thu', value: 4 },
    { label: 'Friday', short: 'Fri', value: 5 },
    { label: 'Saturday', short: 'Sat', value: 6 },
  ];

  const orderedDays = useMemo(() => {
    const baseDays = [
      { label: 'Sunday', short: 'Sun', value: 0 },
      { label: 'Monday', short: 'Mon', value: 1 },
      { label: 'Tuesday', short: 'Tue', value: 2 },
      { label: 'Wednesday', short: 'Wed', value: 3 },
      { label: 'Thursday', short: 'Thu', value: 4 },
      { label: 'Friday', short: 'Fri', value: 5 },
      { label: 'Saturday', short: 'Sat', value: 6 },
    ];
    const resetIndex = baseDays.findIndex((d) => d.value === weeklyResetDay);
    if (resetIndex !== -1) {
      return [
        ...baseDays.slice(resetIndex),
        ...baseDays.slice(0, resetIndex),
      ];
    }
    return baseDays;
  }, [weeklyResetDay]);

  // Subscribe to Schedule Blocks
  useEffect(() => {
    if (!user || !pageId) return;

    const q = query(
      collection(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks'),
      orderBy('startTime', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const loaded: ScheduleBlock[] = [];
      snapshot.forEach((doc) => {
        loaded.push({ id: doc.id, ...doc.data() } as ScheduleBlock);
      });
      setBlocks(loaded);
    });

    return () => unsub();
  }, [user, pageId]);

  // Keep track of current time and check for notifications
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      
      setCurrentTime(timeStr);
      setCurrentDayNum(now.getDay());
    };

    updateTime();
    const timer = setInterval(updateTime, 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, []);

  // Track notifications to prevent duplicate alerts in the same minute
  const [notifiedBlocksThisMinute, setNotifiedBlocksThisMinute] = useState<Record<string, string>>({});

  // Notification engine for "important" blocks
  useEffect(() => {
    if (!currentTime || blocks.length === 0) return;

    blocks.forEach((block) => {
      if (
        block.type === 'important' &&
        block.dayOfWeek === currentDayNum &&
        block.startTime === currentTime
      ) {
        // Only trigger if we haven't notified for this block and time combination yet
        const key = `${block.id}_${currentTime}`;
        if (!notifiedBlocksThisMinute[key]) {
          setNotifiedBlocksThisMinute((prev) => ({ ...prev, [key]: currentTime }));
          
          // Play fanfare sound and show visual alert
          playAscendingFanfare();
          showToast(`⏰ IMPORTANT EVENT STARTING: "${block.title}" is starting right now! (${formatTimeStr(block.startTime, is12Hour)} - ${formatTimeStr(block.endTime, is12Hour)})`, "success");
        }
      }
    });
  }, [currentTime, currentDayNum, blocks, notifiedBlocksThisMinute, showToast]);

  // Clean stale notification keys once the minute passes
  useEffect(() => {
    setNotifiedBlocksThisMinute((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((k) => {
        if (next[k] !== currentTime) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [currentTime]);

  // Calculate currently happening block
  const currentBlock = useMemo(() => {
    if (!currentTime) return null;
    return blocks.find((b) => {
      if (b.dayOfWeek !== currentDayNum) return false;
      return currentTime >= b.startTime && currentTime < b.endTime;
    }) || null;
  }, [blocks, currentTime, currentDayNum]);

  // Calculate next upcoming block for today
  const nextBlock = useMemo(() => {
    if (!currentTime) return null;
    const todayBlocks = blocks.filter((b) => b.dayOfWeek === currentDayNum);
    return todayBlocks.find((b) => b.startTime > currentTime) || null;
  }, [blocks, currentTime, currentDayNum]);

  // Form handler for adding or editing with custom validations and overlap detection
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user || !pageId) return;

    if (!title.trim()) {
      setFormError("Task / Event Title is required");
      return;
    }

    if (startTime >= endTime) {
      setFormError("Start time must be strictly before end time");
      return;
    }

    // Check overlap with another schedule
    const isOverlapping = (
      dayA: number, startA: string, endA: string,
      dayB: number, startB: string, endB: string
    ) => {
      if (dayA !== dayB) return false;
      return startA < endB && startB < endA;
    };

    const overlappingBlock = blocks.find((b) => {
      if (editingBlockId && b.id === editingBlockId) return false;
      return isOverlapping(dayOfWeek, startTime, endTime, b.dayOfWeek, b.startTime, b.endTime);
    });

    if (overlappingBlock) {
      setFormError(`Time slot overlaps with "${overlappingBlock.title}" (${formatTimeStr(overlappingBlock.startTime, is12Hour)} - ${formatTimeStr(overlappingBlock.endTime, is12Hour)})`);
      return;
    }

    const blockData = {
      title: title.trim(),
      dayOfWeek,
      startTime,
      endTime,
      type: type === 'important' ? 'important' : 'normal',
      color: color || (type === 'important' ? 'rose' : 'emerald'),
    };

    try {
      if (editingBlockId) {
        await updateDoc(
          doc(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks', editingBlockId),
          blockData
        );
        showToast("Schedule block updated!", "success");
      } else {
        await addDoc(
          collection(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks'),
          blockData
        );
        showToast("New schedule block created!", "success");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      showToast("Failed to save schedule block", "error");
    }
  };

  const resetForm = () => {
    setTitle('');
    setStartTime('06:00');
    setEndTime('07:00');
    setType('normal');
    setColor('emerald');
    setIsAddingBlock(false);
    setEditingBlockId(null);
    setFormError(null);
  };

  const handleEditClick = (block: ScheduleBlock) => {
    setTitle(block.title);
    setDayOfWeek(block.dayOfWeek);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    const bType = block.type === 'important' ? 'important' : 'normal';
    setType(bType);
    setColor(block.color || (bType === 'important' ? 'rose' : 'emerald'));
    setEditingBlockId(block.id);
    setIsAddingBlock(true);
    setFormError(null);
  };

  const handleDelete = async (id: string) => {
    if (!user || !pageId) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks', id));
      showToast("Schedule block deleted", "info");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete schedule block", "error");
    }
  };

  // Style helper based on time-block type & color
  const getBlockStyle = (blockType: string, blockColor?: string, isCurrent = false) => {
    const activePulse = isCurrent ? 'ring-2 ring-offset-2 ring-offset-black animate-pulse' : '';
    const chosenColor = blockColor || (blockType === 'important' ? 'rose' : 'emerald');

    switch (chosenColor) {
      case 'purple':
        return {
          bg: 'bg-purple-950/25 hover:bg-purple-950/35 border-purple-500/40 text-purple-300',
          badge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
          bar: 'bg-purple-500',
          ring: activePulse ? `${activePulse} ring-purple-500` : '',
          text: 'text-purple-400'
        };
      case 'blue':
        return {
          bg: 'bg-blue-950/25 hover:bg-blue-950/35 border-blue-500/40 text-blue-300',
          badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
          bar: 'bg-blue-500',
          ring: activePulse ? `${activePulse} ring-blue-500` : '',
          text: 'text-blue-400'
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-950/25 hover:bg-indigo-950/35 border-indigo-500/40 text-indigo-300',
          badge: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
          bar: 'bg-indigo-500',
          ring: activePulse ? `${activePulse} ring-indigo-500` : '',
          text: 'text-indigo-400'
        };
      case 'amber':
        return {
          bg: 'bg-amber-950/25 hover:bg-amber-950/35 border-amber-500/40 text-amber-300',
          badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
          bar: 'bg-amber-500',
          ring: activePulse ? `${activePulse} ring-amber-500` : '',
          text: 'text-amber-400'
        };
      case 'rose':
        return {
          bg: 'bg-rose-950/25 hover:bg-rose-950/35 border-rose-500/40 text-rose-300',
          badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
          bar: 'bg-rose-500',
          ring: activePulse ? `${activePulse} ring-rose-500` : '',
          text: 'text-rose-400'
        };
      case 'teal':
        return {
          bg: 'bg-teal-950/25 hover:bg-teal-950/35 border-teal-500/40 text-teal-300',
          badge: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
          bar: 'bg-teal-500',
          ring: activePulse ? `${activePulse} ring-teal-500` : '',
          text: 'text-teal-400'
        };
      case 'fuchsia':
        return {
          bg: 'bg-fuchsia-950/25 hover:bg-fuchsia-950/35 border-fuchsia-500/40 text-fuchsia-300',
          badge: 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30',
          bar: 'bg-fuchsia-500',
          ring: activePulse ? `${activePulse} ring-fuchsia-500` : '',
          text: 'text-fuchsia-400'
        };
      case 'emerald':
      default:
        return {
          bg: 'bg-emerald-950/25 hover:bg-emerald-950/35 border-emerald-500/40 text-emerald-300',
          badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          bar: 'bg-emerald-500',
          ring: activePulse ? `${activePulse} ring-emerald-500` : '',
          text: 'text-emerald-400'
        };
    }
  };

  return (
    <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl flex flex-col overflow-hidden text-left h-[750px] lg:h-[800px] shadow-lg shadow-purple-500/5">
      {/* Top Banner / Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#111] bg-[#0d0d0d] shrink-0">
        <div className="flex items-center gap-3">
          <Calendar className="text-purple-500" size={20} />
          <div>
            <h2 className="text-sm font-black text-white tracking-widest uppercase">Weekly Planner & Schedule</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">Plan your weekly time blocks and activities</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Time format selector */}
          <div className="flex bg-[#111] rounded-lg p-0.5 border border-[#222]">
            <button
              type="button"
              onClick={() => setIs12Hour(false)}
              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${!is12Hour ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              24H
            </button>
            <button
              type="button"
              onClick={() => setIs12Hour(true)}
              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded transition-all cursor-pointer ${is12Hour ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              12H
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#111] border border-[#222] text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Announcement bar on top of the dashboard */}
      <div className="px-6 py-3.5 bg-gradient-to-r from-purple-950/20 via-[#0d0d0d] to-purple-950/10 border-b border-[#1a1a1a] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${currentBlock ? 'bg-purple-500 animate-ping' : 'bg-gray-600'}`} />
            <div className="text-[11px] font-black uppercase tracking-widest">
              <span className="text-gray-500">Currently Happening: </span>
              {currentBlock ? (
                <span className={`ml-1 font-extrabold ${getBlockStyle(currentBlock.type, currentBlock.color).text}`}>
                  {currentBlock.title} ({formatTimeStr(currentBlock.startTime, is12Hour)} – {formatTimeStr(currentBlock.endTime, is12Hour)})
                </span>
              ) : (
                <span className="text-gray-600 ml-1 italic font-normal">Free Time / No active scheduled event</span>
              )}
            </div>
          </div>
          {nextBlock && (
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              <span>Up Next today:</span>
              <span className="text-gray-400">{nextBlock.title}</span>
              <span className="px-1.5 py-0.5 rounded bg-[#111] border border-[#222] text-purple-400 font-mono">{formatTimeStr(nextBlock.startTime, is12Hour)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Layout Grid */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Left Column: Form/Adding and general information */}
        <div className="w-full lg:w-80 border-r border-[#111] bg-[#0d0d0d] p-5 overflow-y-auto shrink-0 flex flex-col gap-4">
          
          <button
            onClick={handleAddClick}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-purple-500/10 transition-all cursor-pointer shrink-0"
          >
            {isAddingBlock ? <X size={14} /> : <Plus size={14} />}
            {isAddingBlock ? 'Cancel Editing' : 'Add Time Box'}
          </button>

          {isAddingBlock && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4 bg-[#111]/40 border border-[#1a1a1a] rounded-lg p-4 text-xs animate-fadeIn">
              <h3 className="font-black text-[10px] uppercase tracking-wider text-purple-400">
                {editingBlockId ? 'Edit Time Box' : 'Configure Time Box'}
              </h3>
              
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Task / Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Deep Work, Gym, Rest"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className={`w-full bg-[#111] border ${formError?.includes("Title") ? 'border-rose-500 focus:border-rose-500' : 'border-[#222] focus:border-purple-500'} rounded-lg px-3 py-2 text-white font-medium outline-none transition-colors`}
                />
              </div>

              <DayOfWeekPicker
                value={dayOfWeek}
                onChange={(nextDay) => {
                  setDayOfWeek(nextDay);
                  if (!editingBlockId) {
                    const { start, end } = getLatestBlockTimes(nextDay, blocks);
                    setStartTime(start);
                    setEndTime(end);
                  }
                }}
                options={orderedDays}
                label="Day of Week"
              />

              <div className="grid grid-cols-2 gap-2">
                <TimePicker
                  value={startTime}
                  onChange={(val) => setStartTime(val)}
                  is12Hour={is12Hour}
                  label="Start Time"
                  align="left"
                />
                <TimePicker
                  value={endTime}
                  onChange={(val) => setEndTime(val)}
                  is12Hour={is12Hour}
                  label="End Time"
                  align="right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Time Box Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['normal', 'important'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setType(t);
                        if (t === 'important' && color === 'emerald') setColor('rose');
                        if (t === 'normal' && color === 'rose') setColor('emerald');
                      }}
                      className={`py-2 text-[9px] font-black uppercase rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        type === t
                          ? t === 'normal'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-500/5'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500 shadow-md shadow-rose-500/5'
                          : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t === 'normal' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Block Accent Color</label>
                <div className="grid grid-cols-4 gap-2 pt-0.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setColor(c.id)}
                      className={`py-1.5 px-2 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        color === c.id
                          ? 'bg-[#1e1e1e] border-white text-white shadow-lg scale-[1.03]'
                          : 'bg-[#111] border-[#222] text-gray-400 hover:text-gray-200 hover:bg-[#161616]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${c.bgClass} shrink-0`} />
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10.5px] leading-snug">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-[#2383e2] hover:bg-opacity-90 text-white font-black text-[10px] uppercase tracking-widest rounded-lg transition-all shadow-md cursor-pointer"
              >
                {editingBlockId ? 'Update Block' : 'Add to Schedule'}
              </button>
            </form>
          )}

          {/* Quick instructions panel */}
          <div className="bg-[#111]/20 border border-[#1a1a1a]/60 rounded-xl p-4 text-[11px] leading-relaxed text-gray-500 space-y-2.5 mt-auto">
            <div className="flex gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
              <p><strong className="text-rose-400 uppercase font-black tracking-wide text-[10px]">Important Time Box:</strong> Triggers a sound and notification alert when it starts!</p>
            </div>
            <div className="flex gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0 mt-1.5" />
              <p><strong className="text-purple-400 uppercase font-black tracking-wide text-[10px]">Custom Colors:</strong> Customize each block's accent color for easy visual identification.</p>
            </div>
          </div>
        </div>

        {/* Right Content: Calendar board */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#070707] p-5">
          
          {/* Day switcher for narrow screens/mobiles */}
          <div className="flex lg:hidden overflow-x-auto gap-2 pb-3.5 -mx-4 px-4 [&::-webkit-scrollbar]:hidden shrink-0 items-center border-b border-[#141414] mb-3">
            {orderedDays.map((d) => {
              const dayBlocksCount = blocks.filter((b) => b.dayOfWeek === d.value).length;
              const isActive = activeTabDay === d.value;
              const isToday = currentDayNum === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setActiveTabDay(d.value)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer whitespace-nowrap shrink-0 relative ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20 scale-[1.03]'
                      : 'bg-[#0f0f0f] border border-[#1a1a1a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {isToday && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-purple-500'} animate-pulse shrink-0`} />
                  )}
                  <span>{isActive ? d.label : d.short}</span>
                  {dayBlocksCount > 0 && (
                    <span className={`px-1.5 py-0.5 text-[8px] font-black rounded-md ${
                      isActive ? 'bg-purple-800/80 text-purple-200' : 'bg-[#1a1a1a] text-gray-400'
                    }`}>
                      {dayBlocksCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Desktop/Landscape Weekly Board Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="hidden lg:grid grid-cols-7 gap-3 h-full min-h-[450px]">
              {orderedDays.map((day) => {
                const dayBlocks = blocks.filter((b) => b.dayOfWeek === day.value);
                const isToday = currentDayNum === day.value;

                return (
                  <div
                    key={day.value}
                    className={`flex flex-col bg-[#0b0b0b] border rounded-xl overflow-hidden min-h-[350px] transition-all ${
                      isToday
                        ? 'border-purple-600/50 shadow-lg shadow-purple-500/5 bg-[#0f0a14]/10'
                        : 'border-[#141414] hover:border-[#1e1e1e]'
                    }`}
                  >
                    {/* Column Header */}
                    <div className={`px-3 py-2 flex items-center justify-between border-b shrink-0 ${isToday ? 'bg-purple-950/20 border-purple-500/20' : 'bg-[#0f0f0f] border-[#161616]'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-purple-400' : 'text-gray-500'}`}>
                        {day.label}
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Column Blocks Area */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar select-none bg-[#0a0a0a]/30">
                      {dayBlocks.length > 0 ? (
                        dayBlocks.map((block) => {
                          const isCurrent = currentTime && currentDayNum === day.value && currentTime >= block.startTime && currentTime < block.endTime;
                          const bStyle = getBlockStyle(block.type, block.color, isCurrent);

                          return (
                            <div
                              key={block.id}
                              className={`group border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all relative overflow-hidden ${bStyle.bg} ${bStyle.ring}`}
                            >
                              {/* Left status indicator line */}
                              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${bStyle.bar}`} />
                              
                              <div className="flex items-start justify-between gap-2.5">
                                <span className="text-[11.5px] font-extrabold tracking-wide text-white leading-snug">
                                  {block.title}
                                </span>
                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditClick(block)}
                                    className="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-[#222]/50 transition-colors cursor-pointer"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(block.id)}
                                    className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-[#222]/50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 font-mono">
                                <Clock size={10} className="text-gray-500 shrink-0" />
                                <span>{formatTimeStr(block.startTime, is12Hour)} – {formatTimeStr(block.endTime, is12Hour)}</span>
                              </div>

                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${bStyle.badge}`}>
                                  {block.type}
                                </span>
                                {isCurrent && (
                                  <span className="flex items-center gap-1 text-[8px] text-purple-400 font-black uppercase tracking-widest animate-pulse">
                                    <span className="w-1 h-1 rounded-full bg-purple-500" /> Active
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-4 py-12 text-center border border-dashed border-[#1a1a1a]/40 rounded-lg text-gray-700">
                          <p className="text-[10px] font-bold uppercase tracking-wider italic">No planned tasks</p>
                          <span className="text-[8px] text-gray-800 uppercase tracking-widest mt-1">Add blocks to this day</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile/Narrow view day content */}
            <div className="lg:hidden">
              {(() => {
                const day = orderedDays.find((d) => d.value === activeTabDay) || orderedDays[0];
                const dayBlocks = blocks.filter((b) => b.dayOfWeek === day.value);
                const isToday = currentDayNum === day.value;

                return (
                  <div className={`flex flex-col bg-[#0b0b0b] border border-[#141414] rounded-xl overflow-hidden min-h-[300px] ${isToday ? 'border-purple-600/40 bg-[#0f0a14]/5' : ''}`}>
                    <div className="px-4 py-3 flex items-center justify-between bg-[#0f0f0f] border-b border-[#161616]">
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-400">
                        {day.label}'s Agenda
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-black uppercase tracking-widest bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded">
                          Today
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {dayBlocks.length > 0 ? (
                        dayBlocks.map((block) => {
                          const isCurrent = currentTime && currentDayNum === day.value && currentTime >= block.startTime && currentTime < block.endTime;
                          const bStyle = getBlockStyle(block.type, block.color, isCurrent);

                          return (
                            <div
                              key={block.id}
                              className={`border rounded-lg p-3.5 flex flex-col gap-2 relative overflow-hidden ${bStyle.bg} ${bStyle.ring}`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${bStyle.bar}`} />
                              
                              <div className="flex items-start justify-between gap-4">
                                <span className="text-[13px] font-black tracking-wide text-white">
                                  {block.title}
                                </span>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditClick(block)}
                                    className="p-1.5 rounded bg-[#1c1c1c] text-gray-400 hover:text-white"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(block.id)}
                                    className="p-1.5 rounded bg-[#1c1c1c] text-gray-400 hover:text-red-400"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 font-mono">
                                <Clock size={12} className="text-gray-500 shrink-0" />
                                <span>{formatTimeStr(block.startTime, is12Hour)} – {formatTimeStr(block.endTime, is12Hour)}</span>
                              </div>

                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${bStyle.badge}`}>
                                  {block.type}
                                </span>
                                {isCurrent && (
                                  <span className="flex items-center gap-1 text-[8px] text-purple-400 font-black uppercase tracking-widest animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Active
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-16 text-center border border-dashed border-[#1a1a1a] rounded-lg text-gray-700">
                          <p className="text-xs font-black uppercase tracking-widest italic">No schedule blocks added</p>
                          <span className="text-[9px] text-gray-800 uppercase tracking-widest block mt-2">Use the form on the left to plan your day</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
