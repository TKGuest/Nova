'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { Plus, Trash2, Table as TableIcon, LayoutGrid, Check, Type, Hash, Calendar as CalendarIcon, Settings2, GripVertical, MoreVertical, Copy, Edit3, ChevronDown, ChevronRight, Edit, X, ChevronLeft, StickyNote, Activity, Type as TypeIcon, Settings, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Checkbox } from '@/components/ui/Checkbox';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modals';
import { format, isSameDay, startOfDay, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, parseISO, addDays, isAfter, isSameWeek, getYear, getMonth, addMonths, subMonths, setYear, setMonth, isSameMonth } from 'date-fns';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LexoRank } from 'lexorank';
import { CoverImage } from '@/components/ui/CoverImage';

type PropertyType = 'habit' | 'counter' | 'notes';
type TextSize = 'small' | 'medium' | 'large';

interface MasterTask {
  id: string;
  name: string;
  sortOrder: string;
  type: PropertyType;
}

interface PageRecord {
  id: string;
  date: string;
  data: Record<string, boolean>;
  notes?: string;
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
  const [pageMeta, setPageMeta] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<{ initialDate?: Date } | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDefaultCoverModalOpen, setIsDefaultCoverModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, taskId: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, label: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const savedSize = localStorage.getItem(`habits_text_size_${pageId}`);
    if (savedSize) setTextSize(savedSize as TextSize);
    const savedFormat = localStorage.getItem(`habits_counter_format_${pageId}`);
    if (savedFormat) setCounterFormat(savedFormat as 'fraction' | 'percent');
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
    if (!user) return;
    const qMaster = query(collection(db, 'users', user.uid, 'pages', pageId, 'master_tasks'), orderBy('sortOrder', 'asc'));
    const unsubMaster = onSnapshot(qMaster, (snapshot) => {
      setMasterTasks(snapshot.docs.map(d => ({ type: 'habit', ...d.data(), id: d.id } as MasterTask)));
    });
    const qRecords = query(collection(db, 'users', user.uid, 'pages', pageId, 'records'), orderBy('date', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snapshot) => {
      setRecords(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PageRecord)));
    });
    const unsubPage = onSnapshot(doc(db, 'users', user.uid, 'pages', pageId), (snapshot) => {
      if (snapshot.exists()) setPageMeta(snapshot.data());
    });
    const handleOpenManager = () => setIsPropertyModalOpen(true);
    window.addEventListener('open-task-manager', handleOpenManager);
    const handleClick = () => { 
      setContextMenu(null);
      setIsSettingsOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => { 
      unsubMaster(); unsubRecords(); unsubPage();
      window.removeEventListener('open-task-manager', handleOpenManager);
      window.removeEventListener('click', handleClick);
    };
  }, [user, pageId]);

  const addMasterTask = async (type: PropertyType = 'habit') => {
    if (!user) return;
    const id = `mtask_${Date.now()}`;
    const sortOrder = masterTasks.length > 0 ? LexoRank.parse(masterTasks[masterTasks.length - 1].sortOrder).genNext().toString() : LexoRank.middle().toString();
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
    const sortOrder = LexoRank.parse(task.sortOrder).genNext().toString();
    await setDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', newId), { ...task, id: newId, name: `${task.name} (Copy)`, sortOrder });
  };

  const toggleCompletion = async (recordId: string, taskId: string, current: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'records', recordId), { [`data.${taskId}`]: !current });
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !user) return;
    const activeTaskId = active.id.toString().split('::')[1];
    const overTaskId = over.id.toString().split('::')[1];
    const oldIndex = masterTasks.findIndex(t => t.id === activeTaskId);
    const newIndex = masterTasks.findIndex(t => t.id === overTaskId);
    const newOrder = arrayMove(masterTasks, oldIndex, newIndex);
    let sortOrder;
    if (newIndex === 0) sortOrder = LexoRank.parse(newOrder[1].sortOrder).genPrev().toString();
    else if (newIndex === newOrder.length - 1) sortOrder = LexoRank.parse(newOrder[newIndex-1].sortOrder).genNext().toString();
    else sortOrder = LexoRank.parse(newOrder[newIndex-1].sortOrder).between(LexoRank.parse(newOrder[newIndex+1].sortOrder)).toString();
    await updateDoc(doc(db, 'users', user.uid, 'pages', pageId, 'master_tasks', activeTaskId), { sortOrder });
  };

  const weeklyGroups = useMemo(() => {
    const groups: Record<string, { label: string, items: PageRecord[] }> = {};
    const today = startOfDay(new Date());
    records.forEach(r => {
      const d = parseISO(r.date);
      const weekKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!groups[weekKey]) {
        const start = startOfWeek(d, { weekStartsOn: 1 });
        groups[weekKey] = { label: `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d yyyy')}`, items: [] };
      }
      groups[weekKey].items.push(r);
    });
    const currentWeekKey = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (!groups[currentWeekKey]) {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      groups[currentWeekKey] = { label: `${format(start, 'MMM d')} – ${format(addDays(start, 6), 'MMM d yyyy')}`, items: [] };
    }
    Object.values(groups).forEach(g => g.items.sort((a, b) => a.date.localeCompare(b.date)));
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  const getTextClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[12px]';
      case 'large': return 'text-[14px]';
      default: return 'text-[10px]';
    }
  };

  const getLabelClasses = () => {
    switch (textSize) {
      case 'medium': return 'text-[9.5px]';
      case 'large': return 'text-[11px]';
      default: return 'text-[8.5px]';
    }
  };

  const getCheckboxScale = () => {
    switch (textSize) {
      case 'medium': return 'scale-[0.85]';
      case 'large': return 'scale-[1.0]';
      default: return 'scale-[0.75]';
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={`w-full flex flex-col bg-[#0a0a0a] ${isPeek ? 'flex-1 min-h-0 overflow-hidden py-4 px-6' : 'py-4 px-4 md:px-10'}`}>
        {/* Header - Hidden in focused peek mode to save space */}
        {!(isPeek && sidePeekRecordId) && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsDatePickerOpen({})} className="flex items-center gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2.5 bg-[#2383e2] text-white rounded-md text-[9px] md:text-[11px] font-black uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg shadow-blue-500/10 shrink-0"><Plus size={14}/> New</button>
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
                className={`flex items-center gap-1.5 md:gap-2.5 px-2 md:px-4 py-1.5 md:py-2.5 rounded-md text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${isSettingsOpen ? 'bg-[#222] text-white' : 'bg-[#1a1a1a] border border-[#2d2d2d] text-gray-400 hover:text-white'}`}
              >
                <Settings size={14}/> Settings
              </button>
              {isSettingsOpen && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 mt-2 z-[100] w-64 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-2xl p-4 space-y-6 text-left">
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Dashboard Tools</span>
                    <button onClick={() => { setIsPropertyModalOpen(true); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#111] border border-[#2d2d2d] text-gray-400 rounded-md text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-[#3d3d3d] transition-all"><Settings2 size={16}/> Manage Properties</button>
                    <button onClick={() => { setIsDefaultCoverModalOpen(true); setIsSettingsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#111] border border-[#2d2d2d] text-gray-400 rounded-md text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-[#3d3d3d] transition-all"><ImageIcon size={16}/> Default Card Cover</button>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Counter Format</span>
                    <div className="flex bg-[#111] rounded-md p-1 border border-[#1a1a1a]">
                      <button onClick={() => setCounterFormat('fraction')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${counterFormat === 'fraction' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>Fraction</button>
                      <button onClick={() => setCounterFormat('percent')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all ${counterFormat === 'percent' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>Percent</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest block">Text Scaling</span>
                    <div className="flex bg-[#111] rounded-md p-1 border border-[#1a1a1a]">
                      <button onClick={() => setTextSize('small')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all ${textSize === 'small' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>A</button>
                      <button onClick={() => setTextSize('medium')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all ${textSize === 'medium' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>A+</button>
                      <button onClick={() => setTextSize('large')} className={`flex-1 px-3 py-2 text-[10px] font-black uppercase rounded transition-all ${textSize === 'large' ? 'bg-[#222] text-blue-400' : 'text-gray-600'}`}>A++</button>
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
          {isPeek && sidePeekRecordId ? (
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
                      pageId={pageId} 
                      recordId={record.id} 
                      coverImage={record.coverImage} 
                    />
                    <div className="flex flex-col gap-1 border-b border-[#1a1a1a] pb-6 mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isSameDay(dateObj, new Date()) ? 'text-blue-500' : 'text-gray-600'}`}>
                        {isSameDay(dateObj, new Date()) ? '@Today' : isSameDay(dateObj, subDays(new Date(), 1)) ? '@Yesterday' : `@${format(dateObj, 'EEEE')}`}
                      </span>
                      <h2 className="text-2xl font-bold text-white tracking-tight">{format(dateObj, 'MMMM d, yyyy')}</h2>
                    </div>

                    <div className="flex-1 space-y-1">
                      <h3 className="text-[10px] font-black uppercase text-gray-700 tracking-widest mb-4 px-1">Daily Habits</h3>
                      <SortableContext items={masterTasks.map(t => `${record.id}::${t.id}`)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-0.5">
                          {masterTasks.filter(t => t.type === 'habit').map(task => (
                            <SortableMasterItem 
                              key={task.id} 
                              id={`${record.id}::${task.id}`} 
                              task={task} 
                              completed={!!record.data?.[task.id]} 
                              onToggle={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} 
                              onContextMenu={(e: any) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, taskId: task.id }); }} 
                              isEditing={editingTaskId === task.id} 
                              onRename={(newName: string) => { updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', task.id), { name: newName }); setEditingTaskId(null); }} 
                              textSizeClass={textSize === 'large' ? 'text-base' : textSize === 'medium' ? 'text-sm' : 'text-[13px]'} 
                              checkboxScale="scale-[1.1]" 
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
                    <div className={`grid gap-2 w-full ${isPeek ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7'}`}>
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
                            <div className={`h-24 w-full relative overflow-hidden shrink-0 border-b border-[#1a1a1a] bg-[#161616] ${!isPeek ? 'hidden md:block' : ''}`}>
                              {record.coverImage && (
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
                                <span className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 block ${isSameDay(dateObj, new Date()) ? 'text-blue-400' : 'text-gray-600'}`}>
                                   {isSameDay(dateObj, new Date()) ? '@Today' : isSameDay(dateObj, subDays(new Date(), 1)) ? '@Yesterday' : `@${format(dateObj, 'EEEE')}`}
                                </span>
                                <h3 className="font-bold text-white text-[10px] tracking-tight">{format(dateObj, 'MMM d, yyyy')}</h3>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: record.id, label: format(dateObj, 'MMM d') }); }} className="opacity-0 group-hover/card:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all"><Trash2 size={11}/></button>
                            </div>
                            <div className="p-1 flex-1 flex flex-col">
                              <div className="space-y-0 min-h-[40px]">
                                <SortableContext items={masterTasks.map(t => `${record.id}::${t.id}`)} strategy={verticalListSortingStrategy}>
                                  {masterTasks.filter(t => t.type === 'habit').map(task => (
                                    <SortableMasterItem key={task.id} id={`${record.id}::${task.id}`} task={task} completed={!!record.data?.[task.id]} onToggle={() => toggleCompletion(record.id, task.id, !!record.data?.[task.id])} onContextMenu={(e: any) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, taskId: task.id }); }} isEditing={editingTaskId === task.id} onRename={(newName: string) => { updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', task.id), { name: newName }); setEditingTaskId(null); }} textSizeClass={getTextClasses()} checkboxScale={getCheckboxScale()} />
                                  ))}
                                </SortableContext>
                              </div>
                              <div className="mt-auto pt-2 space-y-2 border-t border-[#1a1a1a]/30">
                                {masterTasks.filter(t => t.type === 'counter').map(t => (
                                  <div key={t.id} className="px-1.5 py-1 bg-[#161616] rounded border border-[#1a1a1a] flex justify-between items-center">
                                    <span className="text-[7px] font-black uppercase text-gray-600 tracking-widest">{t.name}</span>
                                    <span className={`font-black text-blue-500/80 ${textSize === 'large' ? 'text-[10px]' : 'text-[9px]'}`}>{counterFormat === 'fraction' ? `${completedCount}/${totalCount}` : `${percentage}%`}</span>
                                  </div>
                                ))}
                                {masterTasks.filter(t => t.type === 'notes').map(t => (
                                  <div key={t.id} onClick={(e) => e.stopPropagation()} className={`px-1.5 py-1.5 bg-[#161616] rounded border border-[#1a1a1a] space-y-1 ${!isPeek ? 'hidden md:block' : ''}`}>
                                    <span className="text-[7px] font-black uppercase text-gray-600 tracking-widest block">{t.name}</span>
                                    <textarea 
                                      className={`w-full bg-transparent text-gray-400 placeholder:text-gray-800 outline-none resize-none p-0 border-none leading-tight ${textSize === 'large' ? 'text-[9px]' : 'text-[8px]'}`} 
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
                    {masterTasks.filter(t => t.type !== 'notes').map(task => (
                      <th key={task.id} className="p-4 font-black text-[9px] uppercase tracking-widest text-gray-500 min-w-[120px] text-center">{task.name}</th>
                    ))}
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
                        {masterTasks.filter(t => t.type !== 'notes').map(task => (
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
      <Modal isOpen={isPropertyModalOpen} onClose={() => setIsPropertyModalOpen(false)} title="Master Task Definitions">
        <div className="space-y-4 p-1">
          <div className="flex gap-2 pb-4 border-b border-[#1a1a1a]">
            <button onClick={() => addMasterTask('habit')} className="flex-1 py-2 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-500 hover:text-white hover:border-[#3d3d3d] transition-all"><Plus size={14}/> <span className="text-[8px] font-black uppercase">Habit</span></button>
            <button onClick={() => addMasterTask('counter')} className="flex-1 py-2 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-500 hover:text-white hover:border-[#3d3d3d] transition-all"><Activity size={14}/> <span className="text-[8px] font-black uppercase">Counter</span></button>
            <button onClick={() => addMasterTask('notes')} className="flex-1 py-2 flex flex-col items-center gap-1.5 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg text-gray-500 hover:text-white hover:border-[#3d3d3d] transition-all"><StickyNote size={14}/> <span className="text-[8px] font-black uppercase">Notes</span></button>
          </div>
          <div className="space-y-2">
            {masterTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2 bg-[#1e1e1e] border border-[#2d2d2d] rounded-[8px] hover:border-[#3d3d3d] group">
                <GripVertical size={14} className="text-gray-700" />
                <div className="w-6 flex justify-center">{task.type === 'notes' ? <StickyNote size={12} className="text-gray-600"/> : task.type === 'counter' ? <Activity size={12} className="text-gray-600"/> : <Check size={12} className="text-gray-600"/>}</div>
                <input className="flex-1 bg-transparent text-[11.5px] font-bold text-gray-300 outline-none" defaultValue={task.name} onBlur={(e) => updateDoc(doc(db, 'users', user?.uid || '', 'pages', pageId, 'master_tasks', task.id), { name: (e.target as HTMLInputElement).value })} />
                <button onClick={() => deleteMasterTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
              </div>
            ))}
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

function SortableMasterItem({ id, task, completed, onToggle, onContextMenu, isEditing, onRename, textSizeClass, checkboxScale }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [tempName, setTempName] = useState(task.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);
  if (task.type !== 'habit') return null;
  return (
    <div ref={setNodeRef} style={style} onContextMenu={onContextMenu} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 px-1 py-0.5 rounded-md hover:bg-[#252526] transition-all group/item min-h-[22px]">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity"><GripVertical size={10} className="text-gray-800" /></div>
      <div className={`${checkboxScale} origin-left shrink-0`} onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={completed} onClick={onToggle} />
      </div>
      {isEditing ? (
        <input ref={inputRef} className={`flex-1 bg-transparent font-medium text-blue-400 outline-none border-b border-blue-500/50 ${textSizeClass}`} value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={() => onRename(tempName)} onKeyDown={(e) => { if (e.key === 'Enter') onRename(tempName); if (e.key === 'Escape') onRename(task.name); }} />
      ) : (
        <span className={`flex-1 font-medium truncate tracking-tight transition-all ${completed ? 'text-gray-700 line-through' : 'text-gray-400'} ${textSizeClass}`}>{task.name}</span>
      )}
    </div>
  );
}
