'use client';

import React, { useState, useEffect } from 'react';
import { 
  format, 
  parseISO, 
  isAfter,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Calendar, 
  Clock, 
  Sparkles, 
  Award, 
  Bell, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight,
  Repeat,
  Zap,
  RotateCcw
} from 'lucide-react';
import { TimePicker } from '@/components/ui/TimePicker';
import { HabitStats } from '@/types';
import { doc, setDoc, deleteDoc, updateDoc, collection, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '@/context/NotificationContext';
import { playDing } from '@/lib/sounds';

export type TaskType = 'once' | 'repetitive';
export type ResetIntervalOption = 'every_day' | 'every_3_days' | 'every_week' | 'every_2_weeks' | 'every_month' | 'custom';

export interface TodoItem {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  createdAt: number;
  dueDate?: string;     // YYYY-MM-DD
  dueTime?: string;     // HH:mm
  reminderEnabled?: boolean;
  pointsValue?: number;
  completedAt?: number;
  
  // Repetitive / Fused Weekly Task fields
  taskType?: TaskType;                      // 'once' | 'repetitive'
  resetInterval?: ResetIntervalOption;      // 'every_day' | 'every_3_days' | 'every_week' | 'every_2_weeks' | 'every_month' | 'custom'
  resetIntervalDays?: number;               // 1, 3, 7, 14, 30, or custom N
  lastCompletedAt?: number;                 // Timestamp when task was last checked
  nextResetAt?: number;                     // Timestamp when task will auto-reset to active
}

export function getResetDays(interval?: ResetIntervalOption, customDays?: number): number {
  if (interval === 'every_day') return 1;
  if (interval === 'every_3_days') return 3;
  if (interval === 'every_week') return 7;
  if (interval === 'every_2_weeks') return 14;
  if (interval === 'every_month') return 30;
  if (interval === 'custom') return Math.max(1, customDays || 1);
  return 7;
}

export function getResetLabel(interval?: ResetIntervalOption, customDays?: number): string {
  if (interval === 'every_day') return 'Every Day';
  if (interval === 'every_3_days') return 'Every 3 Days';
  if (interval === 'every_week') return 'Every Week';
  if (interval === 'every_2_weeks') return 'Every 2 Weeks';
  if (interval === 'every_month') return 'Every Month';
  if (interval === 'custom') return `Every ${customDays || 1} Days`;
  return 'Every Week';
}

interface DatePickerProps {
  selectedDate: string;
  onChange: (dateStr: string) => void;
  label?: string;
}

export function DatePicker({ selectedDate, onChange, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      try {
        return parseISO(selectedDate);
      } catch (e) {}
    }
    return new Date();
  });

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(prev => addMonths(prev, 1));
  };

  const handleSelectDay = (day: Date, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = () => {
      setIsOpen(false);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isOpen]);

  const parsedSelected = selectedDate ? parseISO(selectedDate) : null;

  return (
    <div className="relative space-y-1" onClick={(e) => e.stopPropagation()}>
      {label && <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white text-left flex items-center justify-between outline-none focus:border-indigo-500 hover:border-[#3e3e3e] transition-all cursor-pointer h-[38px]"
      >
        <span className={selectedDate ? 'text-white font-semibold' : 'text-gray-500'}>
          {selectedDate ? format(parseISO(selectedDate), 'MMMM d, yyyy') : 'No Due Date (Optional)'}
        </span>
        <div className="flex items-center gap-1.5">
          {selectedDate && (
            <span
              onClick={handleClear}
              title="Clear / No Date"
              className="p-1 hover:bg-[#333] hover:text-red-400 text-gray-400 rounded transition-colors cursor-pointer"
            >
              <X size={12} />
            </span>
          )}
          <Calendar size={14} className="text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-[#161616] border border-[#2d2d2d] rounded-xl p-3 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150 right-0 md:left-0">
          <button
            type="button"
            onClick={handleClear}
            className={`w-full mb-2 py-1.5 px-2 text-center text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              !selectedDate
                ? 'bg-indigo-600 text-white font-extrabold'
                : 'bg-[#222] text-gray-300 hover:bg-[#2a2a2a] hover:text-white border border-[#2d2d2d]'
            }`}
          >
            No Due Date
          </button>

          <div className="flex items-center justify-between mb-3 pt-1 border-t border-[#222]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-black uppercase text-gray-300 tracking-wider">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {weekDays.map(d => (
              <span key={d} className="text-[9px] font-black uppercase text-gray-600">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isSelected = parsedSelected && isSameDay(day, parsedSelected);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => handleSelectDay(day, e)}
                  className={`
                    h-7 w-7 text-[10px] font-bold rounded-md flex items-center justify-center transition-all cursor-pointer
                    ${!isCurrentMonth ? 'text-gray-700 hover:bg-transparent' : 'text-gray-300 hover:bg-[#222]'}
                    ${isToday ? 'border border-indigo-500/50 text-indigo-400' : ''}
                    ${isSelected ? 'bg-indigo-600 text-white font-black hover:bg-indigo-500' : ''}
                  `}
                  disabled={!isCurrentMonth}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="flex justify-end border-t border-[#222] mt-2.5 pt-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-[9px] font-black uppercase text-red-400 hover:text-red-300 tracking-wider cursor-pointer"
              >
                Clear Date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TodoDashboardProps {
  pageId: string;
  gamificationStats: HabitStats | null;
  showPointAnnouncement: (text: string, delta: number) => void;
  onClose: () => void;
}

export function TodoDashboard({
  pageId,
  gamificationStats,
  showPointAnnouncement,
  onClose
}: TodoDashboardProps) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  
  // States
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'once' | 'repetitive' | 'completed'>('all');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  // Add form states
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [pointsValue, setPointsValue] = useState(15);
  const [taskType, setTaskType] = useState<TaskType>('once');
  const [resetInterval, setResetInterval] = useState<ResetIntervalOption>('every_week');
  const [customResetDays, setCustomResetDays] = useState(7);

  // Edit states
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);
  const [editPointsValue, setEditPointsValue] = useState(15);
  const [editTaskType, setEditTaskType] = useState<TaskType>('once');
  const [editResetInterval, setEditResetInterval] = useState<ResetIntervalOption>('every_week');
  const [editCustomResetDays, setEditCustomResetDays] = useState(7);

  // Check browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      if (result === 'granted') {
        showToast('Notifications enabled successfully!', 'success');
      } else {
        showToast('Notification permission denied.', 'error');
      }
    } catch (e) {
      console.error('Failed to request permission', e);
    }
  };

  // Sync / Listen to Todos subcollection
  useEffect(() => {
    if (!user || !pageId) return;

    const todosRef = collection(db, 'users', user.uid, 'pages', pageId, 'todos');
    const q = query(todosRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TodoItem[];
      setTodos(items);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching todos:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, pageId]);

  // Auto-reset check for repetitive tasks whose nextResetAt has elapsed
  useEffect(() => {
    if (!todos || todos.length === 0 || !user || !pageId) return;

    const now = Date.now();
    todos.forEach(async (todo) => {
      if (todo.taskType === 'repetitive' && todo.completed) {
        const intervalDays = todo.resetIntervalDays || getResetDays(todo.resetInterval);
        const resetAt = todo.nextResetAt || (todo.lastCompletedAt ? todo.lastCompletedAt + (intervalDays * 24 * 60 * 60 * 1000) : 0);
        
        if (resetAt > 0 && now >= resetAt) {
          try {
            const todoRef = doc(db, 'users', user.uid, 'pages', pageId, 'todos', todo.id);
            await updateDoc(todoRef, {
              completed: false,
              completedAt: null,
              nextResetAt: null
            });
          } catch (e) {
            console.error('Auto reset failed for task', todo.id, e);
          }
        }
      }
    });
  }, [todos, user, pageId]);

  // Create To-do task
  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pageId) return;
    if (!title.trim()) {
      showToast('Please enter a task title', 'error');
      return;
    }

    try {
      const todoId = `todo_${uuidv4().substring(0, 8)}`;
      
      if (reminderEnabled && permissionStatus !== 'granted') {
        const status = await Notification.requestPermission();
        setPermissionStatus(status);
      }

      const todoDocRef = doc(db, 'users', user.uid, 'pages', pageId, 'todos', todoId);
      const intervalDays = taskType === 'repetitive' ? getResetDays(resetInterval, customResetDays) : undefined;

      const newTodo: TodoItem = {
        id: todoId,
        title: title.trim(),
        notes: notes.trim() || '',
        completed: false,
        createdAt: Date.now(),
        dueDate: dueDate || '',
        dueTime: dueDate ? dueTime : '',
        reminderEnabled: reminderEnabled && !!dueDate,
        pointsValue,
        taskType,
        resetInterval: taskType === 'repetitive' ? resetInterval : undefined,
        resetIntervalDays: intervalDays
      };

      await setDoc(todoDocRef, newTodo);

      // Save corresponding Reminder to reminders collection
      if (newTodo.reminderEnabled && newTodo.dueDate && newTodo.dueTime) {
        const reminderRef = doc(db, 'users', user.uid, 'pages', pageId, 'reminders', `todo_${todoId}`);
        const dateTimeStr = new Date(`${newTodo.dueDate}T${newTodo.dueTime}`).toISOString();
        
        await setDoc(reminderRef, {
          id: `todo_${todoId}`,
          title: `To-do Reminder: ${newTodo.title}`,
          body: newTodo.notes || 'Time to complete your task!',
          type: 'once',
          dateTime: dateTimeStr,
          active: true,
          createdAt: Date.now()
        });
      }

      // Reset
      setTitle('');
      setNotes('');
      setDueDate('');
      setDueTime('09:00');
      setReminderEnabled(false);
      setPointsValue(15);
      setTaskType('once');
      setResetInterval('every_week');
      setCustomResetDays(7);
      setIsAdding(false);
      showToast(taskType === 'repetitive' ? 'Repetitive task created!' : 'One-time task created!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to create task', 'error');
    }
  };

  // Toggle Todo completion
  const handleToggleCompletion = async (todo: TodoItem) => {
    if (!user || !pageId) return;

    const nextCompleted = !todo.completed;
    const todoRef = doc(db, 'users', user.uid, 'pages', pageId, 'todos', todo.id);

    try {
      const updateData: any = {
        completed: nextCompleted,
        completedAt: nextCompleted ? Date.now() : null
      };

      if (nextCompleted && todo.taskType === 'repetitive') {
        const intervalDays = todo.resetIntervalDays || getResetDays(todo.resetInterval);
        const nextReset = Date.now() + (intervalDays * 24 * 60 * 60 * 1000);
        updateData.lastCompletedAt = Date.now();
        updateData.nextResetAt = nextReset;
      } else if (!nextCompleted && todo.taskType === 'repetitive') {
        updateData.nextResetAt = null;
      }

      // 1. Update To-do document
      await updateDoc(todoRef, updateData);

      // 2. Manage points with gamification stats
      const statsRef = doc(db, 'users', user.uid, 'pages', pageId, 'gamification', 'stats');
      const statsSnap = await getDoc(statsRef);
      if (statsSnap.exists()) {
        const stats = statsSnap.data() as any;
        const basePoints = todo.pointsValue ?? 15;
        const multiplier = stats.streakMultiplierActive !== false ? (stats.streakMultiplier ?? 1.0) : 1.0;
        const pointsChange = Math.round(basePoints * multiplier);

        let newPoints = stats.points || 0;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        let pointsEarnedToday = stats.pointsEarnedToday || 0;
        
        if (stats.lastPointGainDate !== todayStr) {
          pointsEarnedToday = 0;
        }

        const DAILY_CAP = stats.dailyPointCap ?? 200;
        let actualGain = pointsChange;

        if (nextCompleted) {
          if (pointsEarnedToday + actualGain > DAILY_CAP) {
            actualGain = Math.max(0, DAILY_CAP - pointsEarnedToday);
          }
          newPoints += actualGain;
          pointsEarnedToday += actualGain;
          playDing();
          showPointAnnouncement(actualGain > 0 ? `+${actualGain} pts` : 'Daily cap reached', actualGain);
        } else {
          newPoints = Math.max(0, newPoints - pointsChange);
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

      // 3. Update corresponding Reminder
      const reminderRef = doc(db, 'users', user.uid, 'pages', pageId, 'reminders', `todo_${todo.id}`);
      if (nextCompleted) {
        await updateDoc(reminderRef, { active: false }).catch(() => {});
      } else {
        if (todo.reminderEnabled && todo.dueDate && todo.dueTime) {
          const reminderDateTime = new Date(`${todo.dueDate}T${todo.dueTime}`);
          if (isAfter(reminderDateTime, new Date())) {
            await updateDoc(reminderRef, { active: true }).catch(() => {});
          }
        }
      }

      showToast(nextCompleted ? 'Task completed!' : 'Task marked as active', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to toggle task completion', 'error');
    }
  };

  // Manual Reset Task
  const handleManualReset = async (todo: TodoItem) => {
    if (!user || !pageId) return;
    try {
      const todoRef = doc(db, 'users', user.uid, 'pages', pageId, 'todos', todo.id);
      await updateDoc(todoRef, {
        completed: false,
        completedAt: null,
        nextResetAt: null
      });
      showToast(`"${todo.title}" reset to active!`, 'success');
    } catch (err) {
      showToast('Failed to reset task', 'error');
    }
  };

  // Delete To-do
  const handleDeleteTodo = async (todoId: string) => {
    if (!user || !pageId) return;

    try {
      const todoRef = doc(db, 'users', user.uid, 'pages', pageId, 'todos', todoId);
      await deleteDoc(todoRef);

      const reminderRef = doc(db, 'users', user.uid, 'pages', pageId, 'reminders', `todo_${todoId}`);
      await deleteDoc(reminderRef).catch(() => {});

      showToast('Task deleted!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete task', 'error');
    }
  };

  // Start Edit Mode
  const handleStartEdit = (todo: TodoItem) => {
    setEditingTodoId(todo.id);
    setEditTitle(todo.title);
    setEditNotes(todo.notes || '');
    setEditDueDate(todo.dueDate || '');
    setEditDueTime(todo.dueTime || '09:00');
    setEditReminderEnabled(todo.reminderEnabled || false);
    setEditPointsValue(todo.pointsValue ?? 15);
    setEditTaskType(todo.taskType || 'once');
    setEditResetInterval(todo.resetInterval || 'every_week');
    setEditCustomResetDays(todo.resetIntervalDays || 7);
  };

  // Save Edit
  const handleSaveEdit = async (todoId: string) => {
    if (!user || !pageId) return;
    if (!editTitle.trim()) {
      showToast('Please enter a task title', 'error');
      return;
    }

    try {
      const todoRef = doc(db, 'users', user.uid, 'pages', pageId, 'todos', todoId);
      const intervalDays = editTaskType === 'repetitive' ? getResetDays(editResetInterval, editCustomResetDays) : undefined;
      
      const updatedFields: Partial<TodoItem> = {
        title: editTitle.trim(),
        notes: editNotes.trim() || '',
        dueDate: editDueDate || '',
        dueTime: editDueDate ? editDueTime : '',
        reminderEnabled: editReminderEnabled && !!editDueDate,
        pointsValue: editPointsValue,
        taskType: editTaskType,
        resetInterval: editTaskType === 'repetitive' ? editResetInterval : undefined,
        resetIntervalDays: intervalDays
      };

      await updateDoc(todoRef, updatedFields);

      // Update corresponding Reminder
      const reminderRef = doc(db, 'users', user.uid, 'pages', pageId, 'reminders', `todo_${todoId}`);
      if (updatedFields.reminderEnabled && updatedFields.dueDate && updatedFields.dueTime) {
        const dateTimeStr = new Date(`${updatedFields.dueDate}T${updatedFields.dueTime}`).toISOString();
        await setDoc(reminderRef, {
          id: `todo_${todoId}`,
          title: `To-do Reminder: ${updatedFields.title}`,
          body: updatedFields.notes || 'Time to complete your task!',
          type: 'once',
          dateTime: dateTimeStr,
          active: true,
          createdAt: Date.now()
        });
      } else {
        await deleteDoc(reminderRef).catch(() => {});
      }

      setEditingTodoId(null);
      showToast('Task updated!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update task', 'error');
    }
  };

  // Filter list
  const filteredTodos = todos.filter(t => {
    if (filterTab === 'completed') return t.completed;
    if (t.completed) return false;
    if (filterTab === 'once') return (t.taskType || 'once') === 'once';
    if (filterTab === 'repetitive') return t.taskType === 'repetitive';
    return true; // 'all' active
  });

  return (
    <div className="text-left space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161616] border border-[#2d2d2d] rounded-2xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Check size={20} className="stroke-[3]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                To-Do & Repetitive Tasks
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider border border-indigo-500/20">
                  Fused Hub
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-semibold tracking-wide mt-0.5">
                Manage one-time tasks alongside repetitive tasks that auto-reset on a schedule (daily, 3 days, weekly, monthly)!
              </p>
            </div>
          </div>
        </div>

        {/* Browser Permission Prompt */}
        {permissionStatus !== 'granted' && (
          <button
            onClick={handleRequestPermission}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase text-amber-400 hover:text-white hover:bg-amber-600/20 rounded-lg transition-all cursor-pointer shrink-0"
          >
            <Bell size={12} /> Enable Alarms
          </button>
        )}
      </div>

      {/* Tabs / Filters and New Task Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3">
        <div className="flex flex-wrap bg-[#111] rounded-lg p-1 border border-[#1a1a1a] gap-1">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterTab === 'all' ? 'bg-[#222] text-indigo-400 font-black shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            All Active ({todos.filter(t => !t.completed).length})
          </button>
          <button
            onClick={() => setFilterTab('once')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
              filterTab === 'once' ? 'bg-[#222] text-indigo-400 font-black shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Zap size={11} /> One-Time ({todos.filter(t => !t.completed && (t.taskType || 'once') === 'once').length})
          </button>
          <button
            onClick={() => setFilterTab('repetitive')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
              filterTab === 'repetitive' ? 'bg-[#222] text-purple-400 font-black shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Repeat size={11} /> Repetitive ({todos.filter(t => !t.completed && t.taskType === 'repetitive').length})
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterTab === 'completed' ? 'bg-[#222] text-emerald-400 font-black shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Completed ({todos.filter(t => t.completed).length})
          </button>
        </div>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
          >
            <Plus size={14} /> Add Task
          </button>
        )}
      </div>

      {/* Add Task Inline Form */}
      {isAdding && (
        <form onSubmit={handleCreateTodo} className="bg-[#161616] border border-[#2d2d2d] rounded-xl p-5 space-y-4 shadow-lg animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-[#222] pb-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Create New Task</span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 text-gray-500 hover:text-white rounded hover:bg-[#222]"
            >
              <X size={15} />
            </button>
          </div>

          {/* Task Type Switcher */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">Task Type</label>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button
                type="button"
                onClick={() => setTaskType('once')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  taskType === 'once'
                    ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                    : 'bg-[#121212] border-[#2d2d2d] text-gray-500 hover:text-gray-300'
                }`}
              >
                <Zap size={14} /> One-Time Task
              </button>
              <button
                type="button"
                onClick={() => setTaskType('repetitive')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  taskType === 'repetitive'
                    ? 'bg-purple-600/15 border-purple-500 text-purple-300'
                    : 'bg-[#121212] border-[#2d2d2d] text-gray-500 hover:text-gray-300'
                }`}
              >
                <Repeat size={14} /> Repetitive Task
              </button>
            </div>
          </div>

          {/* Repetitive Settings */}
          {taskType === 'repetitive' && (
            <div className="p-3.5 bg-[#121212] border border-purple-900/30 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Repeat size={14} /> Reset Frequency (How often it resets)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { key: 'every_day', label: 'Every Day', days: 1 },
                  { key: 'every_3_days', label: 'Every 3 Days', days: 3 },
                  { key: 'every_week', label: 'Every Week', days: 7 },
                  { key: 'every_2_weeks', label: 'Every 2 Weeks', days: 14 },
                  { key: 'every_month', label: 'Every Month', days: 30 },
                  { key: 'custom', label: 'Custom', days: customResetDays }
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setResetInterval(opt.key as ResetIntervalOption)}
                    className={`p-2 rounded-lg border text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                      resetInterval === opt.key
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                        : 'bg-[#1a1a1a] border-[#2d2d2d] text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {resetInterval === 'custom' && (
                <div className="flex items-center gap-2 pt-1 max-w-xs">
                  <span className="text-[10px] font-black uppercase text-gray-400">Reset every</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customResetDays}
                    onChange={(e) => setCustomResetDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-[#1a1a1a] border border-[#2d2d2d] rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] font-black uppercase text-gray-400">days</span>
                </div>
              )}

              <p className="text-[10px] text-gray-500 leading-normal">
                Once checked off, this task automatically resets back to active every{' '}
                <strong className="text-purple-300 font-bold">{getResetLabel(resetInterval, customResetDays)}</strong>.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Task Title *</label>
              <input
                type="text"
                placeholder={taskType === 'repetitive' ? 'e.g., Weekly grocery review, Clean desk...' : 'e.g., Pay electricity bill...'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Points Reward Value</label>
              <input
                type="number"
                min="0"
                max="500"
                value={pointsValue}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setPointsValue(isNaN(val) ? 0 : Math.max(0, val));
                }}
                className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Notes / Description (Optional)</label>
              <textarea
                placeholder="Details or sub-points for this task..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors resize-none h-16"
              />
            </div>

            <div>
              <DatePicker
                selectedDate={dueDate}
                onChange={(dateStr) => {
                  setDueDate(dateStr);
                  if (!dateStr) {
                    setReminderEnabled(false);
                  }
                }}
                label="Target Due Date (Optional)"
              />
            </div>

            {dueDate && (
              <div className="space-y-1.5 p-3.5 bg-[#121212] border border-[#222] rounded-xl flex flex-col justify-center animate-fadeIn">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} className="text-indigo-400" />
                  Time to Notify
                </label>
                <div className="flex gap-2 mt-1">
                  <div className="flex-1">
                    <TimePicker
                      value={dueTime}
                      onChange={(val) => setDueTime(val)}
                    />
                  </div>
                  <label className="flex items-center gap-2 px-3 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg select-none cursor-pointer h-[38px]">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                      className="rounded text-indigo-500 focus:ring-indigo-500 bg-[#222] border-[#2d2d2d] cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Bell size={11} className={reminderEnabled ? 'text-indigo-400' : 'text-gray-500'} /> Alarm On
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] text-gray-400 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              Add Task
            </button>
          </div>
        </form>
      )}

      {/* List of To-dos */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-xs text-gray-500 font-semibold animate-pulse">Loading tasks...</p>
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-12 px-4 bg-[#111] border border-[#1a1a1a] rounded-xl">
            <Calendar className="mx-auto text-gray-600 mb-2.5" size={28} />
            <p className="text-xs text-gray-400 font-bold">No {filterTab} tasks found.</p>
            <p className="text-[10px] text-gray-600 mt-1 max-w-sm mx-auto leading-relaxed">
              Create one-time or repetitive tasks with automatic scheduled resets and optional alarm notifications!
            </p>
          </div>
        ) : (
          filteredTodos.map(todo => {
            const isEditing = editingTodoId === todo.id;
            const isRepetitive = todo.taskType === 'repetitive';

            return (
              <div
                key={todo.id}
                className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-[#141414] border rounded-xl transition-all group gap-4 ${
                  todo.completed
                    ? 'border-[#4f46e5]/30 bg-[#4f46e5]/5 shadow-sm shadow-[#4f46e5]/5'
                    : isRepetitive
                    ? 'border-purple-900/30 hover:border-purple-700/50'
                    : 'border-[#2d2d2d] hover:border-[#3d3d3d]'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0 w-full">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleCompletion(todo)}
                    className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all shrink-0 mt-0.5 cursor-pointer ${
                      todo.completed
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        : 'border-[#3d3d3d] hover:border-indigo-500 text-transparent hover:text-indigo-500/30'
                    }`}
                  >
                    <Check size={12} className="stroke-[3.5]" />
                  </button>

                  {/* Content Area */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-3 bg-[#1e1e1e] p-4 rounded-xl border border-[#2d2d2d] w-full mt-1">
                        {/* Edit Task Type */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-gray-500">Task Type</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditTaskType('once')}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase cursor-pointer ${
                                editTaskType === 'once' ? 'bg-indigo-600 text-white' : 'bg-[#121212] text-gray-400'
                              }`}
                            >
                              One-Time
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditTaskType('repetitive')}
                              className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase cursor-pointer ${
                                editTaskType === 'repetitive' ? 'bg-purple-600 text-white' : 'bg-[#121212] text-gray-400'
                              }`}
                            >
                              Repetitive
                            </button>
                          </div>
                        </div>

                        {editTaskType === 'repetitive' && (
                          <div className="space-y-1 p-2 bg-[#121212] rounded border border-purple-900/30">
                            <label className="text-[8px] font-black uppercase text-purple-400">Reset Frequency</label>
                            <select
                              value={editResetInterval}
                              onChange={(e) => setEditResetInterval(e.target.value as ResetIntervalOption)}
                              className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded px-2 py-1 text-xs text-white"
                            >
                              <option value="every_day">Every Day</option>
                              <option value="every_3_days">Every 3 Days</option>
                              <option value="every_week">Every Week</option>
                              <option value="every_2_weeks">Every 2 Weeks</option>
                              <option value="every_month">Every Month</option>
                              <option value="custom">Custom Days</option>
                            </select>
                            {editResetInterval === 'custom' && (
                              <input
                                type="number"
                                min="1"
                                value={editCustomResetDays}
                                onChange={(e) => setEditCustomResetDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-[#1a1a1a] border border-[#2d2d2d] rounded px-2 py-1 text-xs text-white mt-1"
                                placeholder="Number of days"
                              />
                            )}
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-gray-500">Edit Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="bg-[#121212] border border-[#2d2d2d] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 w-full"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-gray-500">Edit Notes</label>
                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="bg-[#121212] border border-[#2d2d2d] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 w-full resize-none h-14"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-500">Points Value</label>
                            <input
                              type="number"
                              min="0"
                              value={editPointsValue}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setEditPointsValue(isNaN(val) ? 0 : Math.max(0, val));
                              }}
                              className="bg-[#121212] border border-[#2d2d2d] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 w-full h-[38px]"
                            />
                          </div>

                          <div>
                            <DatePicker
                              selectedDate={editDueDate}
                              onChange={(dateStr) => {
                                setEditDueDate(dateStr);
                                if (!dateStr) {
                                  setEditReminderEnabled(false);
                                }
                              }}
                              label="Due Date (Optional)"
                            />
                          </div>
                        </div>

                        {editDueDate && (
                          <div className="space-y-1.5 p-3.5 bg-[#121212] border border-[#222] rounded-xl flex flex-col justify-center animate-fadeIn">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock size={12} className="text-indigo-400" />
                              Time to Notify
                            </label>
                            <div className="flex gap-2 mt-1.5">
                              <div className="flex-1">
                                <TimePicker
                                  value={editDueTime}
                                  onChange={(val) => setEditDueTime(val)}
                                />
                              </div>
                              <label className="flex items-center gap-2 px-3 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg select-none cursor-pointer h-[38px]">
                                <input
                                  type="checkbox"
                                  checked={editReminderEnabled}
                                  onChange={(e) => setEditReminderEnabled(e.target.checked)}
                                  className="rounded text-indigo-500 focus:ring-indigo-500 bg-[#222] border-[#2d2d2d] cursor-pointer"
                                />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                  <Bell size={11} className={editReminderEnabled ? 'text-indigo-400' : 'text-gray-500'} /> Alarm On
                                </span>
                              </label>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingTodoId(null)}
                            className="px-3 py-1.5 text-[10px] font-black uppercase text-gray-400 hover:text-white bg-[#222] rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(todo.id)}
                            className="px-3.5 py-1.5 text-[10px] font-black uppercase text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[13.5px] font-bold tracking-tight break-words ${
                              todo.completed ? 'text-gray-500 line-through decoration-indigo-500/30' : 'text-gray-200'
                            }`}
                          >
                            {todo.title}
                          </span>

                          {/* Task Type Badge */}
                          {isRepetitive ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-purple-300 bg-purple-600/15 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                              <Repeat size={10} /> {getResetLabel(todo.resetInterval, todo.resetIntervalDays)}
                            </span>
                          ) : (
                            <span className="text-[8px] font-extrabold uppercase tracking-wider text-gray-500 bg-[#1e1e1e] border border-[#2d2d2d] px-1.5 py-0.2 rounded shrink-0">
                              One-Time
                            </span>
                          )}
                        </div>

                        {todo.notes && (
                          <p className={`text-[11.5px] leading-relaxed break-words whitespace-pre-wrap ${todo.completed ? 'text-gray-600' : 'text-gray-400'}`}>
                            {todo.notes}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-[9.5px] font-extrabold tracking-wider uppercase text-gray-500">
                          <span className="flex items-center gap-1">
                            <Sparkles size={11} className="text-amber-500" />
                            Reward: <strong className="text-amber-400 font-extrabold">{todo.pointsValue ?? 15} pts</strong>
                          </span>

                          {todo.dueDate && (
                            <span className="flex items-center gap-1.5 text-gray-400">
                              <Calendar size={11} className="text-indigo-400" />
                              Due: <strong className="text-gray-300 font-extrabold">{todo.dueDate} {todo.dueTime || ''}</strong>
                            </span>
                          )}

                          {todo.reminderEnabled && todo.dueDate && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Bell size={11} className="animate-wiggle" />
                              Alarm On
                            </span>
                          )}

                          {/* Repetitive next reset timer info */}
                          {isRepetitive && todo.completed && todo.nextResetAt && (
                            <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              <Clock size={10} /> Resets on {format(new Date(todo.nextResetAt), 'MMM d, h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions (Reset Now for completed repetitive, Edit, Delete) */}
                {!isEditing && (
                  <div className="flex items-center gap-1.5 md:opacity-0 group-hover:opacity-100 transition-all ml-auto shrink-0 self-end md:self-center">
                    {isRepetitive && todo.completed && (
                      <button
                        onClick={() => handleManualReset(todo)}
                        className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-purple-300 bg-purple-600/20 hover:bg-purple-600/30 rounded border border-purple-500/30 transition-all flex items-center gap-1 cursor-pointer"
                        title="Reset task now to uncompleted"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(todo)}
                      className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-[#222] transition-colors"
                      title="Edit Task"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-[#222] transition-colors"
                      title="Delete Task"
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
  );
}
