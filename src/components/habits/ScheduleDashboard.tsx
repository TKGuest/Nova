'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNotification } from '@/context/NotificationContext';
import { playAscendingFanfare, playDing } from '@/lib/sounds';
import { Clock, Plus, Trash2, Edit2, Check, X, Calendar, AlertCircle, Sparkles, Volume2, ArrowRight, GripVertical } from 'lucide-react';

interface ScheduleBlock {
  id: string;
  title: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  type: 'free' | 'normal' | 'important';
  notes?: string;
}

export function ScheduleDashboard({ 
  pageId, 
  daysSorting = 'chrono',
  onClose 
}: { 
  pageId: string; 
  daysSorting?: 'chrono' | 'reverse';
  onClose: () => void 
}) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Form error state for custom beautiful validation matching the theme
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for adding/editing
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(() => daysSorting === 'reverse' ? 0 : 1); // Default Monday (1) or Sunday (0) based on setting
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [type, setType] = useState<'free' | 'normal' | 'important'>('normal');

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
    const todayIndex = baseDays.findIndex((d) => d.value === currentDayNum);
    if (todayIndex !== -1) {
      return [
        ...baseDays.slice(todayIndex),
        ...baseDays.slice(0, todayIndex),
      ];
    }
    return baseDays;
  }, [currentDayNum]);

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
          showToast(`⏰ IMPORTANT EVENT STARTING: "${block.title}" is starting right now! (${block.startTime} - ${block.endTime})`, "success");
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
      setFormError(`Time slot overlaps with "${overlappingBlock.title}" (${overlappingBlock.startTime} - ${overlappingBlock.endTime})`);
      return;
    }

    const blockData = {
      title: title.trim(),
      dayOfWeek,
      startTime,
      endTime,
      type,
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
    setStartTime('09:00');
    setEndTime('10:00');
    setType('normal');
    setIsAddingBlock(false);
    setEditingBlockId(null);
    setFormError(null);
  };

  const handleEditClick = (block: ScheduleBlock) => {
    setTitle(block.title);
    setDayOfWeek(block.dayOfWeek);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setType(block.type);
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

  // Style helper based on time-block type
  const getBlockStyle = (blockType: 'free' | 'normal' | 'important', isCurrent = false) => {
    const activePulse = isCurrent ? 'ring-2 ring-offset-2 ring-offset-black animate-pulse' : '';
    switch (blockType) {
      case 'free':
        return {
          bg: 'bg-emerald-950/20 hover:bg-emerald-950/30 border-emerald-500/40 text-emerald-300',
          badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          dot: 'bg-emerald-500',
          ring: activePulse ? `${activePulse} ring-emerald-500` : '',
        };
      case 'important':
        return {
          bg: 'bg-rose-950/20 hover:bg-rose-950/30 border-rose-500/40 text-rose-300',
          badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
          dot: 'bg-rose-500',
          ring: activePulse ? `${activePulse} ring-rose-500` : '',
        };
      default:
        return {
          bg: 'bg-[#141414] hover:bg-[#1a1a1a] border-[#222] text-gray-300',
          badge: 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400',
          dot: 'bg-gray-500',
          ring: activePulse ? `${activePulse} ring-purple-500` : '',
        };
    }
  };

  return (
    <div className="fixed inset-4 md:inset-10 z-[90] bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-2xl flex flex-col overflow-hidden text-left">
      {/* Top Banner / Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#111] bg-[#0d0d0d] shrink-0">
        <div className="flex items-center gap-3">
          <Calendar className="text-purple-500" size={20} />
          <div>
            <h2 className="text-sm font-black text-white tracking-widest uppercase">Weekly Planner & Schedule</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-0.5">Plan your weekly time blocks and activities</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-[#111] border border-[#222] text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Announcement bar on top of the dashboard */}
      <div className="px-6 py-3.5 bg-gradient-to-r from-purple-950/20 via-[#0d0d0d] to-purple-950/10 border-b border-[#1a1a1a] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${currentBlock ? 'bg-purple-500 animate-ping' : 'bg-gray-600'}`} />
            <div className="text-[11px] font-black uppercase tracking-widest">
              <span className="text-gray-500">Currently Happening: </span>
              {currentBlock ? (
                <span className={`ml-1 font-extrabold ${currentBlock.type === 'free' ? 'text-emerald-400' : currentBlock.type === 'important' ? 'text-rose-400' : 'text-purple-300'}`}>
                  {currentBlock.title} ({currentBlock.startTime} – {currentBlock.endTime})
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
              <span className="px-1.5 py-0.5 rounded bg-[#111] border border-[#222] text-purple-400 font-mono">{nextBlock.startTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Layout Grid */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        
        {/* Left Column: Form/Adding and general information */}
        <div className="w-full lg:w-80 border-r border-[#111] bg-[#0d0d0d] p-5 overflow-y-auto shrink-0 flex flex-col gap-4">
          
          <button
            onClick={() => {
              setIsAddingBlock(!isAddingBlock);
              if (isAddingBlock) resetForm();
            }}
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

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Day of Week</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white font-medium outline-none focus:border-purple-500 transition-colors"
                >
                  {orderedDays.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white font-mono font-bold outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white font-mono font-bold outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Time Box Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['free', 'normal', 'important'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-1.5 text-[9px] font-black uppercase rounded border transition-all cursor-pointer ${
                        type === t
                          ? t === 'free'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                            : t === 'important'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500'
                            : 'bg-purple-500/20 text-purple-400 border-purple-500'
                          : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t}
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
              <p><strong className="text-rose-400 uppercase font-black tracking-wide text-[10px]">Important Time Box:</strong> Will notify you when they start!</p>
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
                          const bStyle = getBlockStyle(block.type, isCurrent);

                          return (
                            <div
                              key={block.id}
                              className={`group border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all relative overflow-hidden ${bStyle.bg} ${bStyle.ring}`}
                            >
                              {/* Left status indicator line */}
                              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${block.type === 'free' ? 'bg-emerald-500' : block.type === 'important' ? 'bg-rose-500' : 'bg-gray-700'}`} />
                              
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
                                <span>{block.startTime} – {block.endTime}</span>
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
                          const bStyle = getBlockStyle(block.type, isCurrent);

                          return (
                            <div
                              key={block.id}
                              className={`border rounded-lg p-3.5 flex flex-col gap-2 relative overflow-hidden ${bStyle.bg} ${bStyle.ring}`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${block.type === 'free' ? 'bg-emerald-500' : block.type === 'important' ? 'bg-rose-500' : 'bg-gray-700'}`} />
                              
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
                                <span>{block.startTime} – {block.endTime}</span>
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
