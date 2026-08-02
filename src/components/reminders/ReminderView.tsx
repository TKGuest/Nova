'use client';

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNotification } from '@/context/NotificationContext';
import { Bell, Clock, Calendar, Plus, Trash2, ShieldAlert, AlertCircle, X } from 'lucide-react';
import { TimePicker } from '@/components/ui/TimePicker';
import { format } from 'date-fns';
import { playDing, playAscendingFanfare } from '@/lib/sounds';

interface Reminder {
  id: string;
  title: string;
  body: string;
  type: 'once' | 'daily' | 'timer';
  time?: string;      // HH:mm for daily
  dateTime?: string;  // ISO for once
  active: boolean;
  createdAt: number;
}

export function ReminderView({ pageId }: { pageId: string }) {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'once' | 'daily'>('daily');
  const [time, setTime] = useState('09:00');
  const [dateTime, setDateTime] = useState('');
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Sync Reminders to Firestore
  useEffect(() => {
    if (!user || !pageId) return;

    const remindersRef = collection(db, 'users', user.uid, 'pages', pageId, 'reminders');
    const q = query(remindersRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snapshot) => {
      let items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reminder[];

      setReminders(items);
      setLoading(false);

      // Trigger sync to Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.active) {
            const activeItems = items
              .filter(r => r.active)
              .map(r => ({
                id: r.id,
                type: r.type,
                title: r.title,
                body: r.body,
                time: r.time || '',
                dateTime: r.dateTime || '',
                active: r.active
              }));
            reg.active.postMessage({
              type: 'SYNC_REMINDERS',
              reminders: activeItems
            });
          }
        }).catch(console.error);
      }
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, pageId]);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      if (result === 'granted') {
        showToast('Notifications enabled successfully!', 'success');
        playAscendingFanfare();
      } else {
        showToast('Notifications permission denied.', 'error');
      }
    } catch (e) {
      console.error('Failed to request permission', e);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pageId) return;
    if (!title.trim()) {
      showToast('Please enter a reminder title', 'error');
      return;
    }

    if (permissionStatus !== 'granted') {
      await Notification.requestPermission().then((status) => {
        setPermissionStatus(status);
      });
    }

    try {
      const remindersRef = collection(db, 'users', user.uid, 'pages', pageId, 'reminders');
      const newReminder: Omit<Reminder, 'id'> = {
        title: title.trim(),
        body: body.trim(),
        type,
        active: true,
        createdAt: Date.now(),
        ...(type === 'daily' ? { time } : { dateTime: dateTime || new Date(Date.now() + 60 * 60 * 1000).toISOString() })
      };

      await addDoc(remindersRef, newReminder);
      showToast('Reminder scheduled successfully!', 'success');
      playDing();

      // Reset form & close
      setTitle('');
      setBody('');
      setIsFormOpen(false);
    } catch (err) {
      console.error('Error adding reminder:', err);
      showToast('Failed to schedule reminder', 'error');
    }
  };

  const handleToggleReminder = async (reminder: Reminder) => {
    if (!user || !pageId) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'pages', pageId, 'reminders', reminder.id);
      await updateDoc(docRef, { active: !reminder.active });
      showToast(reminder.active ? 'Reminder deactivated' : 'Reminder activated', 'success');
      playDing();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!user || !pageId) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'pages', pageId, 'reminders', id);
      await deleteDoc(docRef);
      showToast('Reminder deleted', 'success');
      playDing();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in p-1">
      {/* TOP HUB BAR: TITLE, SYSTEM NOTIFICATION BADGE & CREATE BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#252526] border border-[#2d2d2d] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
            <Bell size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              Scheduled Active Alarms
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-black">
                {reminders.length}
              </span>
            </h2>
            <p className="text-xs text-gray-400">Manage your active alarms and notification schedules.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* SYSTEM NOTIFICATION BADGE */}
          {permissionStatus !== 'granted' ? (
            <button
              onClick={handleRequestPermission}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-gray-950 rounded-xl font-bold transition-all text-xs shrink-0 cursor-pointer shadow-md"
            >
              <ShieldAlert size={14} /> Enable Notifications
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-medium text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              System notifications active
            </div>
          )}

          {/* CREATE NEW ALARM BUTTON */}
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-lg ${
              isFormOpen
                ? 'bg-[#2a2a2c] text-gray-300 hover:bg-[#333] border border-[#3d3d3d]'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
            }`}
          >
            {isFormOpen ? (
              <>
                <X size={15} /> Close Form
              </>
            ) : (
              <>
                <Plus size={15} /> Create New Alarm
              </>
            )}
          </button>
        </div>
      </div>

      {/* EXPANDABLE CREATE ALARM FORM */}
      {isFormOpen && (
        <div className="p-6 rounded-2xl bg-[#252526] border border-[#2d2d2d] shadow-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-3">
            <h3 className="font-bold text-gray-100 flex items-center gap-2 text-sm">
              <Plus size={16} className="text-purple-400" />
              Create Custom Reminder / Alarm
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 hover:bg-[#333] text-gray-400 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleAddReminder} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Reminder Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Meditate, Drink Water, Stand Up"
                  className="w-full bg-[#1e1e1e] text-gray-100 border border-[#2d2d2d] rounded-xl px-4 py-2.5 outline-none focus:border-purple-500 transition-colors text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-gray-400 tracking-wider">Short Note (Optional)</label>
                <input
                  type="text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Optional description..."
                  className="w-full bg-[#1e1e1e] text-gray-100 border border-[#2d2d2d] rounded-xl px-4 py-2.5 outline-none focus:border-purple-500 transition-colors text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('daily')}
                className={`p-3 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'daily'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300 shadow-sm'
                    : 'border-[#2d2d2d] hover:bg-[#1e1e1e] text-gray-400'
                }`}
              >
                <Clock size={16} />
                Daily Routine Alarm
              </button>

              <button
                type="button"
                onClick={() => setType('once')}
                className={`p-3 rounded-xl border text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  type === 'once'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300 shadow-sm'
                    : 'border-[#2d2d2d] hover:bg-[#1e1e1e] text-gray-400'
                }`}
              >
                <Calendar size={16} />
                One-Time Event
              </button>
            </div>

            {type === 'daily' ? (
              <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
                <TimePicker
                  value={time}
                  onChange={(val) => setTime(val)}
                  label="Alarm Time"
                />
              </div>
            ) : (
              <div className="space-y-1.5 bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4 flex flex-col items-center">
                <label className="text-xs font-black uppercase text-gray-400 tracking-wider self-start mb-2">Choose Date & Time</label>
                <CalendarDateTimePicker
                  value={dateTime}
                  onChange={(val) => setDateTime(val)}
                />
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-gray-400 hover:text-white border border-[#2d2d2d] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all text-xs flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer"
              >
                <Bell size={14} /> Schedule Reminder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CURRENT ALARMS LIST */}
      <div className="p-6 rounded-2xl bg-[#252526] border border-[#2d2d2d] shadow-xl space-y-4">
        {loading ? (
          <div className="py-12 text-center text-gray-500 animate-pulse text-xs font-bold">Loading alarms...</div>
        ) : reminders.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-[#2d2d2d] rounded-xl flex flex-col items-center justify-center gap-3">
            <AlertCircle size={32} className="text-gray-500" />
            <div className="space-y-1">
              <p className="font-semibold text-gray-300">No Reminders Scheduled</p>
              <p className="text-xs text-gray-500">Click &quot;Create New Alarm&quot; above to set one up.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${
                  reminder.active
                    ? 'bg-[#1e1e1e] border-purple-500/20 shadow-lg shadow-purple-950/5'
                    : 'bg-[#1e1e1e]/60 border-[#2d2d2d] opacity-60'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-200 truncate text-sm">{reminder.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      reminder.type === 'daily'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {reminder.type === 'daily' ? 'DAILY' : 'ONCE'}
                    </span>
                  </div>
                  {reminder.body && <p className="text-xs text-gray-400 truncate">{reminder.body}</p>}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1">
                    <Clock size={13} className="text-purple-400" />
                    {reminder.type === 'daily' ? (
                      <span>Every day at <strong className="text-purple-300 font-bold">{reminder.time}</strong></span>
                    ) : (
                      <span>Runs once on <strong className="text-purple-300 font-bold">{format(new Date(reminder.dateTime || Date.now()), 'MMM d, h:mm a')}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Toggle active switch */}
                  <button
                    onClick={() => handleToggleReminder(reminder)}
                    title={reminder.active ? "Deactivate alarm" : "Activate alarm"}
                    className={`w-10 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                      reminder.active ? 'bg-purple-600' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      reminder.active ? 'translate-x-5' : 'translate-x-0'
                    }`}></div>
                  </button>

                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    title="Delete alarm"
                    className="p-1.5 hover:bg-[#2a2a2b] rounded-lg text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initialDate = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [selectedHour, setSelectedHour] = useState(initialDate.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes());

  useEffect(() => {
    const nextDate = new Date(selectedDate);
    nextDate.setHours(selectedHour);
    nextDate.setMinutes(selectedMinute);
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);
    onChange(nextDate.toISOString());
  }, [selectedDate, selectedHour, selectedMinute]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const startDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const totalDays = daysInMonth(currentMonth, currentYear);
  const startDay = startDayOfMonth(currentMonth, currentYear);

  const paddingDays = [];
  const prevMonthDays = currentMonth === 0 ? daysInMonth(11, currentYear - 1) : daysInMonth(currentMonth - 1, currentYear);
  for (let i = startDay - 1; i >= 0; i--) {
    paddingDays.push({
      dayNum: prevMonthDays - i,
      isCurrentMonth: false,
      dateObj: new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, prevMonthDays - i)
    });
  }

  const currentMonthDays = [];
  for (let i = 1; i <= totalDays; i++) {
    currentMonthDays.push({
      dayNum: i,
      isCurrentMonth: true,
      dateObj: new Date(currentYear, currentMonth, i)
    });
  }

  const totalCells = paddingDays.length + currentMonthDays.length;
  const nextMonthPaddingCount = (7 - (totalCells % 7)) % 7;
  const nextMonthPaddingDays = [];
  for (let i = 1; i <= nextMonthPaddingCount; i++) {
    nextMonthPaddingDays.push({
      dayNum: i,
      isCurrentMonth: false,
      dateObj: new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, i)
    });
  }

  const allCells = [...paddingDays, ...currentMonthDays, ...nextMonthPaddingDays];
  const today = new Date();

  return (
    <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-2.5 space-y-2 w-full max-w-[270px] shadow-2xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1 hover:bg-[#2d2d2d] rounded-md text-gray-400 hover:text-white transition-colors text-xs cursor-pointer"
        >
          &larr;
        </button>
        <span className="text-[11px] font-bold text-gray-200">
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1 hover:bg-[#2d2d2d] rounded-md text-gray-400 hover:text-white transition-colors text-xs cursor-pointer"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
          <span key={wd} className="text-[8px] font-black uppercase text-gray-500 tracking-wider">
            {wd}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {allCells.map((cell, idx) => {
          const isSelected = selectedDate.getDate() === cell.dateObj.getDate() &&
            selectedDate.getMonth() === cell.dateObj.getMonth() &&
            selectedDate.getFullYear() === cell.dateObj.getFullYear();
            
          const isToday = today.getDate() === cell.dateObj.getDate() &&
            today.getMonth() === cell.dateObj.getMonth() &&
            today.getFullYear() === cell.dateObj.getFullYear();

          return (
            <button
              key={`${cell.dateObj.toISOString()}-${idx}`}
              type="button"
              onClick={() => {
                setSelectedDate(cell.dateObj);
                if (cell.dateObj.getMonth() !== currentMonth) {
                  setCurrentMonth(cell.dateObj.getMonth());
                  setCurrentYear(cell.dateObj.getFullYear());
                }
              }}
              className={`h-[28px] w-full text-[10px] font-semibold rounded flex items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-purple-600 text-white shadow shadow-purple-600/30 font-bold scale-105'
                  : isToday
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold'
                  : cell.isCurrentMonth
                  ? 'text-gray-200 hover:bg-[#2d2d2d]'
                  : 'text-gray-600 hover:bg-[#2d2d2d]/50'
              }`}
            >
              {cell.dayNum}
            </button>
          );
        })}
      </div>

      <div className="border-t border-[#2d2d2d] pt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-gray-400" />
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Time</span>
        </div>
        
        <div className="flex items-center gap-1">
          <select
            value={selectedHour}
            onChange={(e) => setSelectedHour(parseInt(e.target.value))}
            className="bg-[#111] border border-[#2d2d2d] rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-purple-500 transition-colors cursor-pointer"
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>
                {h.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-gray-500 font-bold">:</span>
          <select
            value={selectedMinute}
            onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
            className="bg-[#111] border border-[#2d2d2d] rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-purple-500 transition-colors cursor-pointer"
          >
            {Array.from({ length: 60 }).map((_, m) => (
              <option key={m} value={m}>
                {m.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-[#111] rounded-md p-1.5 text-center text-[9px] font-medium text-purple-300 border border-purple-500/15">
        Scheduled for: <strong className="text-white">{format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), selectedHour, selectedMinute), 'MMM d, yyyy h:mm a')}</strong>
      </div>
    </div>
  );
}
