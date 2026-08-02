'use client';

import React, { useState } from 'react';
import { format, parseISO, startOfDay, addDays } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X, Calendar, Sparkles, Award, HelpCircle } from 'lucide-react';
import { HabitStats } from '@/types';
import { MasterTask, PageRecord, getStartOfWeekDate } from './HabitTracker';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '@/context/NotificationContext';

interface WeeklyTasksDashboardProps {
  pageId: string;
  masterTasks: MasterTask[];
  weeklyRecords: PageRecord[];
  gamificationStats: HabitStats | null;
  onToggleWeeklyCompletion: (recordDateStr: string, taskId: string, current: boolean) => Promise<void>;
  onClose: () => void;
}

export function WeeklyTasksDashboard({
  pageId,
  masterTasks,
  weeklyRecords,
  gamificationStats,
  onToggleWeeklyCompletion,
  onClose
}: WeeklyTasksDashboardProps) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPoints, setEditPoints] = useState<number>(10);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPoints, setNewPoints] = useState(20);

  // Retrieve current weekly reset day and range
  const resetDay = gamificationStats?.weeklyResetDay ?? 1;
  const today = new Date();
  const startOfWeekObj = getStartOfWeekDate(today, resetDay);
  const endOfWeekObj = addDays(startOfWeekObj, 6);
  const weekStr = format(startOfWeekObj, 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  // Find current week's record
  const currentWeeklyRecord = weeklyRecords.find(wr => wr.date === weekStr);
  const weeklyTasks = masterTasks.filter(t => !t.parentId && t.period === 'weekly');

  const completedCount = weeklyTasks.filter(t => !!currentWeeklyRecord?.data?.[t.id]).length;
  const totalCount = weeklyTasks.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Calculate total points earned this week from completed tasks
  const pointsEarnedThisWeek = weeklyTasks.reduce((sum, task) => {
    const isCompleted = !!currentWeeklyRecord?.data?.[task.id];
    if (isCompleted) {
      return sum + (task.pointsValue ?? 10);
    }
    return sum;
  }, 0);

  const handleCreateWeeklyTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pageId) return;
    if (!newName.trim()) return;

    try {
      const id = `prop_${uuidv4().substring(0, 8)}`;
      // Find max sort order in masterTasks to append at the end
      const sortOrder = String(masterTasks.length);

      const taskRef = doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', id);
      await setDoc(taskRef, {
        id,
        name: newName.trim(),
        sortOrder,
        type: 'habit',
        period: 'weekly',
        pointsValue: newPoints,
      });

      setNewName('');
      setNewPoints(20);
      setIsAdding(false);
      showToast('Weekly task created!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to create weekly task', 'error');
    }
  };

  const handleStartEdit = (task: MasterTask) => {
    setEditingTaskId(task.id);
    setEditName(task.name);
    setEditPoints(task.pointsValue ?? 10);
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!user || !pageId) return;
    if (!editName.trim()) return;

    try {
      const taskRef = doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', taskId);
      await updateDoc(taskRef, {
        name: editName.trim(),
        pointsValue: editPoints
      });
      setEditingTaskId(null);
      showToast('Weekly task updated!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update weekly task', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user || !pageId) return;

    try {
      const taskRef = doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', taskId);
      await deleteDoc(taskRef);
      showToast('Weekly task deleted!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete weekly task', 'error');
    }
  };

  const getDayName = (dayIndex: number) => {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
  };

  return (
    <div className="text-left space-y-6">
      {/* Overview Header Card */}
      <div className="bg-[#161616] border border-[#2d2d2d] rounded-2xl p-5 md:p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Weekly Recurrent Goals
                <span className="text-[10px] bg-blue-500/10 text-blue-400 font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider border border-blue-500/20">
                  Weekly Reset
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-semibold tracking-wide mt-0.5">
                {format(startOfWeekObj, 'MMMM d')} – {format(endOfWeekObj, 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          
          <div className="space-y-1 pt-2 max-w-md">
            <div className="flex justify-between text-[11px] font-bold text-gray-400">
              <span>Goal Progress ({completedCount} of {totalCount} completed)</span>
              <span className="text-blue-400">{completionPercentage}%</span>
            </div>
            <div className="h-2 w-full bg-[#1e1e1e] rounded-full overflow-hidden border border-[#2c2c2c]">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main List & Adding form */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black uppercase text-gray-500 tracking-wider">Weekly Tasks List</h3>
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#222] border border-[#2d2d2d] text-xs font-black uppercase text-blue-400 hover:text-white hover:border-[#3d3d3d] rounded-lg transition-all cursor-pointer"
            >
              <Plus size={13} /> New Weekly Task
            </button>
          )}
        </div>

        {/* Add new weekly task inline form */}
        {isAdding && (
          <form onSubmit={handleCreateWeeklyTask} className="bg-[#161616] border border-[#2d2d2d] rounded-xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Create Weekly Goal</span>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="p-1 text-gray-500 hover:text-white rounded hover:bg-[#222]"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Task Title</label>
                <input 
                  type="text"
                  placeholder="e.g. Read 1 book, Clean the entire room..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Points Value</label>
                <input 
                  type="number"
                  min="0"
                  max="500"
                  value={newPoints}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setNewPoints(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button 
                type="submit"
                className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Create Goal
              </button>
            </div>
          </form>
        )}

        {/* List of Tasks */}
        <div className="space-y-2">
          {weeklyTasks.length === 0 ? (
            <div className="text-center py-10 px-4 bg-[#111] border border-[#1a1a1a] rounded-xl">
              <Calendar className="mx-auto text-gray-600 mb-2.5" size={28} />
              <p className="text-xs text-gray-400 font-semibold">No weekly recurring tasks yet.</p>
              <p className="text-[10px] text-gray-600 mt-1 max-w-sm mx-auto leading-relaxed">
                Weekly tasks represent big recurring goals that stay active the whole week and reset on your chosen day.
              </p>
            </div>
          ) : (
            weeklyTasks.map(task => {
              const isCompleted = !!currentWeeklyRecord?.data?.[task.id];
              const isEditing = editingTaskId === task.id;

              return (
                <div 
                  key={task.id}
                  className={`flex items-center justify-between p-3.5 bg-[#141414] border rounded-xl transition-all group ${
                    isCompleted 
                      ? 'border-[#2383e2]/30 bg-[#2383e2]/5 shadow-sm shadow-[#2383e2]/5' 
                      : 'border-[#2d2d2d] hover:border-[#3d3d3d]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Checkbox */}
                    <button 
                      type="button"
                      onClick={() => onToggleWeeklyCompletion(todayStr, task.id, isCompleted)}
                      className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                        isCompleted 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20' 
                          : 'border-[#3d3d3d] hover:border-blue-500 text-transparent hover:text-blue-500/30'
                      }`}
                    >
                      <Check size={12} className="stroke-[3.5]" />
                    </button>

                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2 max-w-lg">
                          <input 
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-[#1e1e1e] border border-[#2d2d2d] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 flex-1"
                          />
                          <input 
                            type="number"
                            min="0"
                            value={editPoints}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setEditPoints(isNaN(val) ? 0 : Math.max(0, val));
                            }}
                            className="bg-[#1e1e1e] border border-[#2d2d2d] rounded px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 w-16"
                          />
                          <button onClick={() => handleSaveEdit(task.id)} className="p-1 text-green-400 hover:bg-[#222] rounded"><Check size={14}/></button>
                          <button onClick={() => setEditingTaskId(null)} className="p-1 text-red-400 hover:bg-[#222] rounded"><X size={14}/></button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className={`text-[13.5px] font-bold tracking-tight truncate ${isCompleted ? 'text-gray-400 line-through decoration-[#2383e2]/40' : 'text-gray-200'}`}>
                            {task.name}
                          </span>
                          <span className="text-[10px] text-gray-500 font-extrabold tracking-wider uppercase mt-0.5 flex items-center gap-1">
                            <Sparkles size={10} className="text-amber-500" />
                            Reward: <strong className="text-amber-400 font-extrabold">{task.pointsValue ?? 10} pts</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions (Rename, Delete) */}
                  {!isEditing && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all ml-4 shrink-0">
                      <button 
                        onClick={() => handleStartEdit(task)}
                        className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-[#222] transition-colors"
                        title="Edit Goal"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-[#222] transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
