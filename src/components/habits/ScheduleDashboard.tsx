'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNotification } from '@/context/NotificationContext';
import { playAscendingFanfare, playDing } from '@/lib/sounds';
import { Clock, Plus, Trash2, Edit2, Check, X, Calendar, AlertCircle, Sparkles, Volume2, ArrowRight, GripVertical, ChevronDown, CalendarDays, LayoutGrid } from 'lucide-react';

import { TimePicker } from '@/components/ui/TimePicker';

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

const formatTimeStr = (time24: string): string => {
  return time24 || '';
};

function DayOfWeekPicker({
  selectedDays,
  onChange,
  options,
  label
}: {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  options: { label: string; short: string; value: number }[];
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

  const toggleDay = (dayVal: number) => {
    if (selectedDays.includes(dayVal)) {
      if (selectedDays.length === 1) return; // Keep at least one day selected
      onChange(selectedDays.filter((d) => d !== dayVal));
    } else {
      onChange([...selectedDays, dayVal]);
    }
  };

  const selectPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all') {
      onChange([0, 1, 2, 3, 4, 5, 6]);
    } else if (preset === 'weekdays') {
      onChange([1, 2, 3, 4, 5]);
    } else if (preset === 'weekends') {
      onChange([0, 6]);
    }
  };

  // Generate label display text
  const getDisplayText = () => {
    if (selectedDays.length === 0) return 'Select Days';
    if (selectedDays.length === options.length) return 'Every Day (All 7)';
    if (selectedDays.length === 5 && [1, 2, 3, 4, 5].every((d) => selectedDays.includes(d))) return 'Weekdays (Mon-Fri)';
    if (selectedDays.length === 2 && [0, 6].every((d) => selectedDays.includes(d))) return 'Weekends (Sat-Sun)';

    // Sort selected days by their order in `options`
    const sorted = options.filter((o) => selectedDays.includes(o.value));
    if (sorted.length <= 3) {
      return sorted.map((o) => o.label).join(', ');
    }
    return `${sorted.length} Days (${sorted.map((o) => o.short).join(', ')})`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#111] border border-[#222] rounded-lg px-2.5 py-2 text-white font-bold text-xs text-left flex items-center justify-between hover:border-purple-500 hover:bg-[#151515] transition-all cursor-pointer select-none"
      >
        <span className="truncate pr-1 text-white font-black">{getDisplayText()}</span>
        <ChevronDown size={11} className="text-gray-500 shrink-0 ml-1.5" />
      </button>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-1 bg-[#141414] border border-[#2d2d2d] rounded-xl shadow-2xl p-2 z-[100] text-xs select-none max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded animate-fadeIn space-y-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick presets */}
          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-[#222]">
            <button
              type="button"
              onClick={() => selectPreset('all')}
              className="flex-1 py-1 px-1.5 text-[9px] font-black uppercase rounded bg-[#1f1f1f] text-gray-300 hover:text-white hover:bg-purple-600 transition-colors"
            >
              All 7
            </button>
            <button
              type="button"
              onClick={() => selectPreset('weekdays')}
              className="flex-1 py-1 px-1.5 text-[9px] font-black uppercase rounded bg-[#1f1f1f] text-gray-300 hover:text-white hover:bg-purple-600 transition-colors"
            >
              Weekdays
            </button>
            <button
              type="button"
              onClick={() => selectPreset('weekends')}
              className="flex-1 py-1 px-1.5 text-[9px] font-black uppercase rounded bg-[#1f1f1f] text-gray-300 hover:text-white hover:bg-purple-600 transition-colors"
            >
              Weekends
            </button>
          </div>

          {/* List of days with checkboxes */}
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = selectedDays.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDay(opt.value)}
                  className={`w-full py-1.5 px-2.5 text-left font-black text-[11px] rounded transition-all cursor-pointer flex items-center justify-between ${
                    isSelected 
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                      : 'text-gray-400 hover:bg-[#222] hover:text-white border border-transparent'
                  }`}
                >
                  <span>{opt.label}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-purple-600 border-purple-400 text-white' : 'border-[#444] bg-[#111]'
                  }`}>
                    {isSelected && <Check size={11} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-1.5 border-t border-[#222] flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md hover:bg-purple-500 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
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
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');

  // Form error state for custom beautiful validation matching the theme
  const [formError, setFormError] = useState<string | null>(null);

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
      const targetDay = selectedDays[0] ?? weeklyResetDay;
      const { start, end } = getLatestBlockTimes(targetDay, blocks);
      setStartTime(start);
      setEndTime(end);
      setIsAddingBlock(true);
    } else {
      resetForm();
    }
  };

  // Form states for adding/editing
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([weeklyResetDay]);
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
          showToast(`⏰ IMPORTANT EVENT STARTING: "${block.title}" is starting right now! (${formatTimeStr(block.startTime)} - ${formatTimeStr(block.endTime)})`, "success");
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

    if (selectedDays.length === 0) {
      setFormError("Please select at least one day of the week");
      return;
    }

    if (startTime >= endTime) {
      setFormError("Start time must be strictly before end time");
      return;
    }

    // Check overlap with another schedule block for any of the selected days
    const isOverlapping = (
      dayA: number, startA: string, endA: string,
      dayB: number, startB: string, endB: string
    ) => {
      if (dayA !== dayB) return false;
      return startA < endB && startB < endA;
    };

    for (const d of selectedDays) {
      const overlappingBlock = blocks.find((b) => {
        if (editingBlockId && b.id === editingBlockId) return false;
        return isOverlapping(d, startTime, endTime, b.dayOfWeek, b.startTime, b.endTime);
      });

      if (overlappingBlock) {
        const dayLabel = DAYS.find((dayObj) => dayObj.value === d)?.label || `Day ${d}`;
        setFormError(`Time slot on ${dayLabel} overlaps with "${overlappingBlock.title}" (${formatTimeStr(overlappingBlock.startTime)} - ${formatTimeStr(overlappingBlock.endTime)})`);
        return;
      }
    }

    const baseBlockData = {
      title: title.trim(),
      startTime,
      endTime,
      type: type === 'important' ? 'important' : 'normal',
      color: color || (type === 'important' ? 'rose' : 'emerald'),
    };

    try {
      if (editingBlockId) {
        // Update the primary block
        await updateDoc(
          doc(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks', editingBlockId),
          {
            ...baseBlockData,
            dayOfWeek: selectedDays[0],
          }
        );

        // If extra days selected while editing, create blocks for those extra days as well
        if (selectedDays.length > 1) {
          const extraDays = selectedDays.slice(1);
          await Promise.all(
            extraDays.map((d) =>
              addDoc(
                collection(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks'),
                {
                  ...baseBlockData,
                  dayOfWeek: d,
                }
              )
            )
          );
          showToast(`Block updated & created on ${selectedDays.length} days!`, "success");
        } else {
          showToast("Schedule block updated!", "success");
        }
      } else {
        // Create new blocks for all selected days
        await Promise.all(
          selectedDays.map((d) =>
            addDoc(
              collection(db, 'users', user.uid, 'pages', pageId, 'schedule_blocks'),
              {
                ...baseBlockData,
                dayOfWeek: d,
              }
            )
          )
        );

        if (selectedDays.length > 1) {
          showToast(`Created ${selectedDays.length} schedule blocks!`, "success");
        } else {
          showToast("New schedule block created!", "success");
        }
      }

      resetForm();
    } catch (err) {
      console.error(err);
      showToast("Failed to save schedule block", "error");
    }
  };

  const resetForm = () => {
    setTitle('');
    setSelectedDays([weeklyResetDay]);
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
    setSelectedDays([block.dayOfWeek]);
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
        
        <div className="flex items-center gap-3">
          {/* View mode toggle: Today vs Full Week */}
          <div className="flex bg-[#111] rounded-lg p-0.5 border border-[#222]">
            <button
              type="button"
              onClick={() => setViewMode('today')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[9.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                viewMode === 'today'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <CalendarDays size={12} />
              <span>Today ({DAYS.find((d) => d.value === currentDayNum)?.short || 'Today'})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[9.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LayoutGrid size={12} />
              <span>Full Week</span>
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
                  {currentBlock.title} ({formatTimeStr(currentBlock.startTime)} – {formatTimeStr(currentBlock.endTime)})
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
              <span className="px-1.5 py-0.5 rounded bg-[#111] border border-[#222] text-purple-400 font-mono">{formatTimeStr(nextBlock.startTime)}</span>
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
                selectedDays={selectedDays}
                onChange={(nextDays) => {
                  setSelectedDays(nextDays);
                  if (!editingBlockId && nextDays.length > 0) {
                    const { start, end } = getLatestBlockTimes(nextDays[0], blocks);
                    setStartTime(start);
                    setEndTime(end);
                  }
                }}
                options={orderedDays}
                label="Days of Week"
              />

              <div className="grid grid-cols-2 gap-2">
                <TimePicker
                  value={startTime}
                  onChange={(val) => setStartTime(val)}
                  label="Start Time"
                  align="left"
                />
                <TimePicker
                  value={endTime}
                  onChange={(val) => setEndTime(val)}
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
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setColor(c.id)}
                      className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                        color === c.id
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0d0d] scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      <span className={`w-full h-full rounded-full ${c.bgClass}`} />
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
                {editingBlockId 
                  ? (selectedDays.length > 1 ? `Update & Create for ${selectedDays.length} Days` : 'Update Block')
                  : (selectedDays.length > 1 ? `Add to Schedule (${selectedDays.length} Blocks)` : 'Add to Schedule')
                }
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
          {viewMode === 'today' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
              {/* Today's Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-950/30 via-[#0d0d0d] to-[#121212] border border-purple-500/20 mb-4 shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white uppercase tracking-wider">
                        {DAYS.find((d) => d.value === currentDayNum)?.label || 'Today'}'s Schedule
                      </h3>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-purple-600 text-white px-2 py-0.5 rounded-md shadow">
                        Today
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                      {blocks.filter((b) => b.dayOfWeek === currentDayNum).length} time block(s) planned for today
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-[10.5px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 shrink-0 group"
                >
                  <LayoutGrid size={14} className="group-hover:scale-110 transition-transform" />
                  <span>Edit Full Weekly Schedule</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Today's Schedule Timeline / Cards */}
              {(() => {
                const todayBlocks = blocks
                  .filter((b) => b.dayOfWeek === currentDayNum)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                if (todayBlocks.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#1f1f1f] rounded-2xl bg-[#090909]">
                      <div className="w-12 h-12 rounded-full bg-[#141414] border border-[#222] flex items-center justify-center text-gray-500 mb-3">
                        <Clock size={24} />
                      </div>
                      <h4 className="text-sm font-black text-gray-300 uppercase tracking-widest">No Events Scheduled for Today</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        Your schedule for {DAYS.find((d) => d.value === currentDayNum)?.label} is completely open. Add a new time box or view your full weekly schedule.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDays([currentDayNum]);
                            handleAddClick();
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow"
                        >
                          <Plus size={14} />
                          <span>Add Time Box for Today</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('week')}
                          className="px-4 py-2 bg-[#161616] hover:bg-[#202020] text-gray-300 border border-[#2d2d2d] font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-2"
                        >
                          <LayoutGrid size={14} />
                          <span>Edit Full Weekly Schedule</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {todayBlocks.map((block) => {
                      const isCurrent = currentTime && currentTime >= block.startTime && currentTime < block.endTime;
                      const bStyle = getBlockStyle(block.type, block.color, isCurrent);

                      return (
                        <div
                          key={block.id}
                          className={`group border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all relative overflow-hidden ${bStyle.bg} ${bStyle.ring}`}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${bStyle.bar}`} />

                          <div className="flex items-start gap-3.5 pl-1.5">
                            <div className="flex flex-col items-center justify-center py-1.5 px-3 bg-[#0a0a0a]/60 border border-[#222]/60 rounded-lg shrink-0 font-mono">
                              <span className="text-[11px] font-black text-white">{formatTimeStr(block.startTime)}</span>
                              <span className="text-[9px] text-gray-500 uppercase font-bold">to</span>
                              <span className="text-[11px] font-black text-white">{formatTimeStr(block.endTime)}</span>
                            </div>

                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black tracking-wide text-white">
                                  {block.title}
                                </span>
                                <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${bStyle.badge}`}>
                                  {block.type}
                                </span>
                                {isCurrent && (
                                  <span className="flex items-center gap-1.5 text-[9px] text-purple-400 font-black uppercase tracking-widest bg-purple-950/40 border border-purple-500/40 px-2 py-0.5 rounded-md animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Active Now
                                  </span>
                                )}
                              </div>
                              {block.notes && (
                                <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                                  {block.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#222]/40 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleEditClick(block)}
                              className="p-2 rounded-lg bg-[#141414] hover:bg-blue-600/20 text-gray-400 hover:text-blue-300 border border-[#222] hover:border-blue-500/40 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(block.id)}
                              className="p-2 rounded-lg bg-[#141414] hover:bg-rose-600/20 text-gray-400 hover:text-rose-300 border border-[#222] hover:border-rose-500/40 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
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
                                    <span>{formatTimeStr(block.startTime)} – {formatTimeStr(block.endTime)}</span>
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
                                    <span>{formatTimeStr(block.startTime)} – {formatTimeStr(block.endTime)}</span>
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
            </>
          )}
        </div>

      </div>
    </div>
  );
}
