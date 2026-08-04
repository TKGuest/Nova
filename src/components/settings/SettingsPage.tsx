'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from '@/context/RouterContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, onSnapshot, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { 
  Settings2, Clock, ArrowLeft, Check, 
  Sparkles, Sliders, Plus, Trash2,
  Activity, StickyNote, ChevronDown, Hash, ListFilter
} from 'lucide-react';
import { LexoRank } from 'lexorank';

const safeParse = (s?: string) => {
  try { return s ? LexoRank.parse(s) : LexoRank.middle(); } catch { return LexoRank.middle(); }
};

export function SettingsPage() {
  const { settings, updateSettings } = useWorkspace();
  const { user } = useAuth();
  const router = useRouter();

  const [counterFormat, setCounterFormat] = useState<'fraction' | 'percent'>('fraction');
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('small');
  const [textTruncateMode, setTextTruncateMode] = useState<'wrap' | 'truncate'>('wrap');
  const [daysSorting, setDaysSorting] = useState<'chrono' | 'reverse'>('chrono');

  const [habitPageId, setHabitPageId] = useState<string | null>(null);
  const [masterTasks, setMasterTasks] = useState<any[]>([]);
  const [gamificationStats, setGamificationStats] = useState<{
    allHabitsBonus?: number;
    weeklyResetDay?: number;
    decayValue?: number;
    dailyPointCap?: number;
    streakTargetTasks?: number;
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Fetch habit stats and master tasks from first habit page if available
  useEffect(() => {
    if (!user) return;
    const fetchHabitStats = async () => {
      try {
        const pagesRef = collection(db, 'users', user.uid, 'pages');
        const pagesSnap = await getDocs(pagesRef);
        const habitPage = pagesSnap.docs.find(d => d.data().type === 'habit');
        if (habitPage) {
          setHabitPageId(habitPage.id);
          const statsRef = doc(db, 'users', user.uid, 'pages', habitPage.id, 'gamification', 'stats');
          const statsSnap = await getDoc(statsRef);
          if (statsSnap.exists()) {
            setGamificationStats(statsSnap.data() as any);
          }
        }
      } catch (err) {
        console.error('Error loading settings gamification stats:', err);
      }
    };
    fetchHabitStats();
  }, [user]);

  // Subscribe to master tasks when habitPageId is loaded
  useEffect(() => {
    if (!user || !habitPageId) return;
    const tasksRef = collection(db, 'users', user.uid, 'pages', habitPageId, 'master_tasks');
    const q = query(tasksRef, orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMasterTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, habitPageId]);

  const addMasterTask = async (type: 'habit' | 'counter' | 'notes' | 'toggle_list' | 'task_counter' = 'habit') => {
    if (!user || !habitPageId) return;
    const defaultNames: Record<string, string> = {
      habit: 'New Habit',
      counter: 'New Counter',
      notes: 'New Note',
      toggle_list: 'New List',
      task_counter: 'New Task Counter'
    };
    const sortOrder = masterTasks.length > 0 
      ? safeParse(masterTasks[masterTasks.length - 1].sortOrder).genNext().toString() 
      : LexoRank.middle().toString();
    const id = doc(collection(db, 'users', user.uid, 'pages', habitPageId, 'master_tasks')).id;
    await setDoc(doc(db, 'users', user.uid, 'pages', habitPageId, 'master_tasks', id), {
      id,
      name: defaultNames[type] || 'New Property',
      sortOrder,
      type,
      period: 'daily'
    });
    triggerSavedNotice();
  };

  const updateMasterTask = async (id: string, updates: any) => {
    if (!user || !habitPageId) return;
    await updateDoc(doc(db, 'users', user.uid, 'pages', habitPageId, 'master_tasks', id), updates);
    triggerSavedNotice();
  };

  const deleteMasterTask = async (id: string) => {
    if (!user || !habitPageId) return;
    await deleteDoc(doc(db, 'users', user.uid, 'pages', habitPageId, 'master_tasks', id));
    triggerSavedNotice();
  };

  const handleUpdateGamificationStats = async (key: string, value: number) => {
    if (!user || !habitPageId) return;
    try {
      const statsRef = doc(db, 'users', user.uid, 'pages', habitPageId, 'gamification', 'stats');
      await updateDoc(statsRef, { [key]: value });
      setGamificationStats(prev => ({ ...prev, [key]: value }));
      triggerSavedNotice();
    } catch (err) {
      console.error('Error updating stats:', err);
    }
  };

  const triggerSavedNotice = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleBack = () => {
    if (habitPageId) {
      router.push(`/page/${habitPageId}`);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#181819] text-gray-200 p-4 md:p-10 select-none">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Banner */}
        <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleBack}
                className="p-2 rounded-lg bg-[#222] border border-[#333] hover:bg-[#2e2e2e] text-gray-400 hover:text-white transition-all cursor-pointer"
                title="Back to Habit Tracker"
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                <Settings2 className="text-blue-400" size={26} /> Settings & Workspace Preferences
              </h1>
            </div>
            <p className="text-xs text-gray-400 pl-11">
              Configure global automation hours, habit tracker display options, and gamification rules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold rounded-lg animate-fade-in">
                <Check size={14} /> Saved
              </div>
            )}
            <button 
              onClick={handleBack}
              className="px-4 py-2 bg-[#252525] hover:bg-[#303030] border border-[#3d3d3d] text-gray-200 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>

        {/* Section 1: Workspace Automation */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 text-blue-400 border-b border-[#2d2d2d] pb-3">
            <Clock size={20} />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Daily Reset & Automation</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Daily Reset Cutoff Hour</label>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                By default, daily habit kanban cards and checklists reset at Midnight (12:00 AM). If you work late or night shifts, choose an alternative hour boundary.
              </p>
              <select 
                value={settings.resetHour ?? 0}
                onChange={(e) => {
                  updateSettings({ resetHour: parseInt(e.target.value) });
                  triggerSavedNotice();
                }}
                className="w-full bg-[#141414] border border-[#333] text-gray-200 rounded-xl px-4 py-2.5 outline-none text-xs font-mono focus:border-blue-500 cursor-pointer mt-2"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "12:00 AM (Midnight)" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM (Noon)" : `${i - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Default Text Density</label>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Adjust font density and scaling across sidebar items and workspace documents.
              </p>
              <div className="flex bg-[#141414] rounded-xl p-1 border border-[#333] mt-2">
                {(['small', 'default', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      updateSettings({ fontSize: size });
                      triggerSavedNotice();
                    }}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      (settings.fontSize || 'default') === size 
                        ? 'bg-[#282828] text-blue-400 border border-[#3d3d3d]' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Edit Master Task & Habit Properties */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-3">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <ListFilter size={20} />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Edit Master Properties</h2>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => addMasterTask('habit')} className="px-2.5 py-1.5 bg-[#141414] border border-[#333] hover:border-emerald-500/50 rounded-lg text-emerald-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"><Plus size={12}/> Habit</button>
              <button onClick={() => addMasterTask('counter')} className="px-2.5 py-1.5 bg-[#141414] border border-[#333] hover:border-emerald-500/50 rounded-lg text-emerald-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"><Activity size={12}/> Counter</button>
              <button onClick={() => addMasterTask('notes')} className="px-2.5 py-1.5 bg-[#141414] border border-[#333] hover:border-emerald-500/50 rounded-lg text-emerald-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"><StickyNote size={12}/> Notes</button>
              <button onClick={() => addMasterTask('toggle_list')} className="px-2.5 py-1.5 bg-[#141414] border border-[#333] hover:border-emerald-500/50 rounded-lg text-emerald-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"><ChevronDown size={12}/> Toggle List</button>
              <button onClick={() => addMasterTask('task_counter')} className="px-2.5 py-1.5 bg-[#141414] border border-[#333] hover:border-emerald-500/50 rounded-lg text-emerald-400 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"><Hash size={12}/> Task Counter</button>
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Manage your master habit and task property definitions. Changes made here apply across all daily record cards and tracking views.
          </p>

          {masterTasks.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#333] rounded-xl text-gray-500 text-xs font-mono">
              No master properties defined yet. Click any button above to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {masterTasks.map((task) => (
                <div key={task.id} className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-3 hover:border-[#444] transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="p-1.5 bg-[#222] border border-[#333] rounded-lg text-emerald-400">
                        {task.type === 'habit' && <Check size={14} />}
                        {task.type === 'counter' && <Activity size={14} />}
                        {task.type === 'notes' && <StickyNote size={14} />}
                        {task.type === 'toggle_list' && <ChevronDown size={14} />}
                        {task.type === 'task_counter' && <Hash size={14} />}
                      </span>
                      <input 
                        type="text" 
                        value={task.name || ''} 
                        onChange={(e) => updateMasterTask(task.id, { name: e.target.value })}
                        className="bg-[#1e1e1e] border border-[#333] focus:border-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg outline-none flex-1 min-w-0"
                        placeholder="Property Name"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={task.type}
                        onChange={(e) => updateMasterTask(task.id, { type: e.target.value })}
                        className="bg-[#1e1e1e] border border-[#333] text-gray-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                      >
                        <option value="habit">Habit</option>
                        <option value="counter">Counter</option>
                        <option value="notes">Notes</option>
                        <option value="toggle_list">Toggle List</option>
                        <option value="task_counter">Task Counter</option>
                      </select>

                      <button 
                        onClick={() => deleteMasterTask(task.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Property"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#252525]">
                    {task.type !== 'toggle_list' && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Reset Interval</span>
                        <select
                          value={task.period || 'daily'}
                          onChange={(e) => updateMasterTask(task.id, { period: e.target.value })}
                          className="bg-[#1e1e1e] border border-[#333] text-white text-[11px] font-mono px-2.5 py-1 rounded-lg outline-none cursor-pointer"
                        >
                          <option value="daily">Daily Habit (Resets daily)</option>
                          <option value="weekly">Weekly Task (Resets weekly)</option>
                        </select>
                      </div>
                    )}

                    {task.type === 'habit' && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Base Points</span>
                        <input 
                          type="number"
                          min={0}
                          value={task.pointsValue ?? 10}
                          onChange={(e) => updateMasterTask(task.id, { pointsValue: parseInt(e.target.value) || 0 })}
                          className="w-20 bg-[#1e1e1e] border border-[#333] text-white text-[11px] font-mono text-right px-2.5 py-1 rounded-lg outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Habit Tracker Preferences */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 text-purple-400 border-b border-[#2d2d2d] pb-3">
            <Sliders size={20} />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Habit Tracker & Display Controls</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Counter Format</label>
              <p className="text-[11px] text-gray-500">Choose how progress numbers are displayed on habit cards.</p>
              <div className="flex bg-[#141414] rounded-xl p-1 border border-[#333]">
                <button 
                  onClick={() => setCounterFormat('fraction')} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${counterFormat === 'fraction' ? 'bg-[#282828] text-purple-400 border border-[#3d3d3d]' : 'text-gray-500'}`}
                >
                  Fraction (e.g., 3/5)
                </button>
                <button 
                  onClick={() => setCounterFormat('percent')} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${counterFormat === 'percent' ? 'bg-[#282828] text-purple-400 border border-[#3d3d3d]' : 'text-gray-500'}`}
                >
                  Percent (e.g., 60%)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Long Task Titles</label>
              <p className="text-[11px] text-gray-500">Decide if long habit titles should wrap or truncate.</p>
              <div className="flex bg-[#141414] rounded-xl p-1 border border-[#333]">
                <button 
                  onClick={() => setTextTruncateMode('wrap')} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${textTruncateMode === 'wrap' ? 'bg-[#282828] text-purple-400 border border-[#3d3d3d]' : 'text-gray-500'}`}
                >
                  Wrap Lines
                </button>
                <button 
                  onClick={() => setTextTruncateMode('truncate')} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${textTruncateMode === 'truncate' ? 'bg-[#282828] text-purple-400 border border-[#3d3d3d]' : 'text-gray-500'}`}
                >
                  Truncate (...)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Weekday Column Order</label>
              <p className="text-[11px] text-gray-500">Sorting order for weekly schedule columns.</p>
              <div className="flex bg-[#141414] rounded-xl p-1 border border-[#333]">
                <button 
                  onClick={() => setDaysSorting('chrono')} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${daysSorting === 'chrono' ? 'bg-[#282828] text-purple-400 border border-[#3d3d3d]' : 'text-gray-500'}`}
                >
                  Mon - Sun
                </button>
                <button 
                  onClick={() => setDaysSorting('reverse')} 
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${daysSorting === 'reverse' ? 'bg-[#282828] text-purple-400 border border-[#3d3d3d]' : 'text-gray-500'}`}
                >
                  Sun, Sat, Fri...
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 block">Weekly Task Reset Day</label>
              <p className="text-[11px] text-gray-500">Day of the week when weekly tasks clear their completions.</p>
              <div className="bg-[#141414] border border-[#333] rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase font-bold">Reset Day</span>
                <select
                  className="bg-transparent text-right outline-none text-white text-xs font-black uppercase cursor-pointer pr-1"
                  value={gamificationStats?.weeklyResetDay ?? 1}
                  onChange={(e) => handleUpdateGamificationStats('weeklyResetDay', parseInt(e.target.value))}
                >
                  <option value={1} className="bg-[#1e1e1e] text-white">Monday</option>
                  <option value={2} className="bg-[#1e1e1e] text-white">Tuesday</option>
                  <option value={3} className="bg-[#1e1e1e] text-white">Wednesday</option>
                  <option value={4} className="bg-[#1e1e1e] text-white">Thursday</option>
                  <option value={5} className="bg-[#1e1e1e] text-white">Friday</option>
                  <option value={6} className="bg-[#1e1e1e] text-white">Saturday</option>
                  <option value={0} className="bg-[#1e1e1e] text-white">Sunday</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Gamification System Rules */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-2.5 text-amber-400 border-b border-[#2d2d2d] pb-3">
            <Sparkles size={20} />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Gamification & RPG System Rules</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-300">Point Decay</span>
                <span className="text-[10px] text-amber-400 font-mono font-bold">-[pt]/day</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-normal">Points deducted daily for uncompleted main habits.</p>
              <input 
                type="number" 
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2 text-white font-mono text-sm outline-none focus:border-amber-500"
                value={gamificationStats?.decayValue ?? 5}
                onChange={(e) => handleUpdateGamificationStats('decayValue', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-300">Daily Point Cap</span>
                <span className="text-[10px] text-amber-400 font-mono font-bold">Max Points</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-normal">Maximum positive points earnable per single day.</p>
              <input 
                type="number" 
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2 text-white font-mono text-sm outline-none focus:border-amber-500"
                value={gamificationStats?.dailyPointCap ?? 200}
                onChange={(e) => handleUpdateGamificationStats('dailyPointCap', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-300">Streak Target Tasks</span>
                <span className="text-[10px] text-amber-400 font-mono font-bold">Required</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-normal">Minimum completed tasks per day to maintain streak.</p>
              <input 
                type="number" 
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2 text-white font-mono text-sm outline-none focus:border-amber-500"
                value={gamificationStats?.streakTargetTasks ?? 1}
                onChange={(e) => handleUpdateGamificationStats('streakTargetTasks', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="bg-[#141414] border border-[#333] rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-200 block">All Main Habits Daily Completion Bonus</span>
              <span className="text-[10px] text-gray-500 block">Extra bonus points awarded when 100% of daily habits are checked off.</span>
            </div>
            <div className="flex items-center gap-2 bg-[#1e1e1e] border border-[#333] px-3 py-1.5 rounded-lg">
              <span className="text-xs text-amber-400 font-bold">+</span>
              <input 
                type="number" 
                className="w-16 bg-transparent text-right outline-none text-white text-xs font-mono font-bold"
                value={gamificationStats?.allHabitsBonus ?? 50}
                onChange={(e) => handleUpdateGamificationStats('allHabitsBonus', parseInt(e.target.value) || 0)}
              />
              <span className="text-[10px] text-gray-500 uppercase font-bold">PTS</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
