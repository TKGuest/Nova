'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import { Link, usePathname, useRouter } from '@/context/RouterContext';
import { Plus, FileText, CalendarCheck2, MoreHorizontal, Star, Link2, Copy, Edit2, CornerUpRight, Trash2, ExternalLink, Columns, Settings, Calendar, Search, Sparkles, Bell, Clock } from 'lucide-react';
import { UserProfile } from '@/components/auth/UserProfile';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useNotification } from '@/context/NotificationContext';

import { PageModel } from '../../types';

export function Sidebar() {
  const { user } = useAuth();
  const { setSidePeekPageId, setSettingsOpen } = useWorkspace();
  const { showToast, confirm: customConfirm } = useNotification();
  const [pages, setPages] = useState<PageModel[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, page: PageModel } | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'users', user.uid, 'pages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let fetched = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PageModel));
      
      if (fetched.length === 0 && !snapshot.metadata.hasPendingWrites) {
        const noteId = Date.now().toString();
        const habitId = (Date.now() + 1).toString();
        
        const notePage: PageModel = { id: noteId, title: "My Workspace", type: "note", createdAt: Date.now() };
        const habitPage: PageModel = { id: habitId, title: "Daily Habits", type: "habit", createdAt: Date.now() + 1 };
        
        await setDoc(doc(db, 'users', user.uid, 'pages', noteId), notePage);
        await setDoc(doc(db, 'users', user.uid, 'pages', habitId), habitPage);
        
        fetched = [notePage, habitPage];
        fetched = [notePage, habitPage];
        router.push(`/page/${noteId}`);
      }

      // Auto-cleanup 30-day old trashed pages
      const now = Date.now();
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      for (const page of fetched) {
        if (page.deletedAt && now - page.deletedAt > THIRTY_DAYS) {
          try { await deleteDoc(doc(db, 'users', user.uid, 'pages', page.id)); } catch {}
        }
      }
      fetched = fetched.filter(page => !(page.deletedAt && now - page.deletedAt > THIRTY_DAYS));

      setPages(fetched);
    });

    return () => unsubscribe();
  }, [user, router]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const createPage = async (type: 'note' | 'habit' | 'reminder') => {
    if (!user) return;
    const id = Date.now().toString();
    const newPage: PageModel = {
      id,
      title: type === 'note' ? 'Untitled Note' : type === 'habit' ? 'New Habit Tracker' : 'Reminders & Alarms Hub',
      type,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', user.uid, 'pages', id), newPage);
    router.push(`/page/${id}`);
  };

  const handleContextMenu = (e: React.MouseEvent, page: PageModel) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      setContextMenu({ x: e.clientX, y: e.clientY, page });
    }, 0);
  };

  const handleRenameCommit = async (id: string, newTitle: string, oldTitle: string) => {
    setRenamingPageId(null);
    if (!user || !newTitle.trim() || newTitle === oldTitle) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'pages', id), { title: newTitle.trim() });
    } catch {}
  };

  const handleOptionAction = async (action: string, page: PageModel) => {
    setContextMenu(null);
    if (!user) return;
    
    if (action === 'favorite') {
      await updateDoc(doc(db, 'users', user.uid, 'pages', page.id), { isFavorite: !page.isFavorite });
    } else if (action === 'rename') {
      setRenamingPageId(page.id);
    } else if (action === 'trash') {
      customConfirm({
        title: 'Move to Trash?',
        message: `Are you sure you want to move "${page.title}" to the trash? It will be permanently deleted after 30 days.`,
        confirmLabel: 'Move to Trash',
        onConfirm: async () => {
          await updateDoc(doc(db, 'users', user.uid, 'pages', page.id), { deletedAt: Date.now() });
          if (pathname === `/page/${page.id}`) router.push('/');
          showToast('Page moved to trash');
        }
      });
    } else if (action === 'restore') {
      await updateDoc(doc(db, 'users', user.uid, 'pages', page.id), { deletedAt: null });
      showToast('Page restored');
    } else if (action === 'permanent-delete') {
      customConfirm({
        title: 'Permanently Delete?',
        message: `Are you sure you want to permanently delete "${page.title}"? This cannot be undone.`,
        confirmLabel: 'Delete Forever',
        onConfirm: async () => {
          await deleteDoc(doc(db, 'users', user.uid, 'pages', page.id));
          if (pathname === `/page/${page.id}`) router.push('/');
          showToast('Page deleted permanently');
        }
      });
    } else if (action === 'copy-link') {
      const url = `${window.location.origin}/#/page/${page.id}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard');
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { 
          document.execCommand('copy'); 
          showToast('Link copied to clipboard'); 
        } catch (err) { 
          showToast('Failed to copy link', 'error'); 
        }
        document.body.removeChild(textArea);
      }
    } else if (action === 'duplicate') {
      const id = Date.now().toString();
      await setDoc(doc(db, 'users', user.uid, 'pages', id), {
        id, title: `${page.title} (Copy)`, type: page.type, createdAt: Date.now()
      });
      router.push(`/page/${id}`);
    } else if (action === 'new-tab') {
      window.open(`/#/page/${page.id}`, '_blank');
    } else if (action === 'side-peek') {
      setSidePeekPageId(page.id);
    }
  };

  if (!user) return null;

  const activePages = pages.filter(p => !p.deletedAt);
  const trashedPages = pages.filter(p => !!p.deletedAt);

  return (
    <>
      <aside className="w-full md:w-64 border-r border-[#2d2d2d] bg-[#121212] md:bg-[#252526] flex flex-col shrink-0 justify-between h-full relative">
        {/* DESKTOP VIEW */}
        <div className="hidden md:flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#2d2d2d] flex items-center justify-between shrink-0">
            <h1 className="font-semibold text-sm select-none truncate opacity-80">Workspace Workspace</h1>
          </div>
          
          <div className="p-2 flex-1 overflow-y-auto">
            {activePages.filter(p => p.isFavorite).length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-2 hover:bg-[#2a2a2b] py-1 rounded cursor-pointer transition-colors duration-200 w-fit">
                  Favorites
                </div>
                <nav className="flex flex-col gap-[2px]">
                  {activePages.filter(p => p.isFavorite).map(page => (
                    <div 
                      key={page.id} 
                      className={`group relative flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                        pathname === `/page/${page.id}` ? 'bg-[#37373d]' : 'hover:bg-[#2a2a2b]'
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, page)}
                    >
                      <Link href={`/page/${page.id}`} className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0">
                        {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : page.type === 'habit' ? <CalendarCheck2 size={16} className="text-gray-400 shrink-0" /> : <Bell size={16} className="text-purple-400 shrink-0" />}
                        <span className="truncate text-sm text-gray-200 font-medium">{page.title}</span>
                      </Link>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, page); }}
                        className={`shrink-0 p-1 mr-1 text-gray-500 hover:bg-[#454545] rounded ${pathname === `/page/${page.id}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  ))}
                </nav>
              </div>
            )}
            
            <div className="mb-6">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-2 hover:bg-[#2a2a2b] py-1 rounded cursor-pointer transition-colors duration-200 w-fit">
                System
              </div>
              <nav className="flex flex-col gap-[2px]">
                <Link 
                  href="/calendar" 
                  className={`group relative flex items-center justify-between rounded-md transition-colors cursor-pointer px-3 py-1.5 ${
                    pathname === '/calendar' ? 'bg-[#37373d]' : 'hover:bg-[#2a2a2b]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Calendar size={16} className="text-blue-400 shrink-0" />
                    <span className="truncate text-sm text-gray-200 font-medium">Calendar</span>
                  </div>
                </Link>
                <button 
                  onClick={() => setIsTrashOpen(!isTrashOpen)}
                  className={`group relative flex items-center justify-between rounded-md transition-colors cursor-pointer px-3 py-1.5 ${
                    isTrashOpen ? 'bg-[#37373d]' : 'hover:bg-[#2a2a2b]'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Trash2 size={16} className="text-gray-400 shrink-0" />
                    <span className="truncate text-sm text-gray-200 font-medium">Trash</span>
                  </div>
                </button>
              </nav>
            </div>

            {isTrashOpen && trashedPages.length > 0 && (
              <div className="mb-6 bg-[#1a1a1a] rounded-lg p-1 border border-[#333]">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 px-2 py-1">
                  Deleted Pages (30 Days)
                </div>
                <nav className="flex flex-col gap-[2px] max-h-[150px] overflow-y-auto custom-scrollbar">
                  {trashedPages.map(page => (
                    <div 
                      key={page.id} 
                      className="group relative flex items-center justify-between rounded-md transition-colors cursor-pointer hover:bg-[#2a2a2b] opacity-70 hover:opacity-100"
                      onContextMenu={(e) => handleContextMenu(e, page)}
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0">
                        {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : page.type === 'habit' ? <CalendarCheck2 size={16} className="text-gray-400 shrink-0" /> : <Bell size={16} className="text-purple-400 shrink-0" />}
                        <span className="truncate text-sm text-gray-300 font-medium line-through">{page.title}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, page); }}
                        className="shrink-0 p-1 mr-1 text-gray-500 hover:bg-[#454545] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  ))}
                </nav>
              </div>
            )}
            
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-2 hover:bg-[#2a2a2b] py-1 rounded cursor-pointer transition-colors duration-200 w-fit">
              Recents
            </div>
            <nav className="flex flex-col gap-[2px]">
              {activePages.map(page => (
                <div 
                  key={page.id} 
                  className={`group relative flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                    pathname === `/page/${page.id}` ? 'bg-[#37373d]' : 'hover:bg-[#2a2a2b]'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, page)}
                >
                  {renamingPageId === page.id ? (
                     <div className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0">
                       {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : page.type === 'habit' ? <CalendarCheck2 size={16} className="text-gray-400 shrink-0" /> : <Bell size={16} className="text-purple-400 shrink-0" />}
                       <input 
                         autoFocus
                         className="flex-1 min-w-0 bg-[#37373d] text-sm text-gray-200 border border-[#2383e2] rounded px-1.5 py-0.5 outline-none font-medium h-[22px]"
                         defaultValue={page.title}
                         onBlur={(e) => handleRenameCommit(page.id, e.target.value, page.title)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') e.currentTarget.blur();
                           if (e.key === 'Escape') setRenamingPageId(null);
                         }}
                         onClick={(e) => e.stopPropagation()}
                       />
                     </div>
                  ) : (
                    <Link 
                      href={`/page/${page.id}`} 
                      className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0"
                    >
                      {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : page.type === 'habit' ? <CalendarCheck2 size={16} className="text-gray-400 shrink-0" /> : <Bell size={16} className="text-purple-400 shrink-0" />}
                      <span className="truncate text-sm text-gray-200 font-medium">{page.title}</span>
                    </Link>
                  )}
                  
                  {renamingPageId !== page.id && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleContextMenu(e, page); }}
                      className={`shrink-0 p-1 mr-1 text-gray-500 hover:bg-[#454545] rounded ${pathname === `/page/${page.id}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                </div>
              ))}
            </nav>
            
            <div className="mt-6 px-1">
              <button onClick={() => createPage('note')} className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2b] rounded-md transition-colors text-left text-sm cursor-pointer">
                <Plus size={16} /> <span className="font-medium">New Note</span>
              </button>
              <button onClick={() => createPage('habit')} className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2b] rounded-md transition-colors text-left text-sm cursor-pointer">
                <Plus size={16} /> <span className="font-medium">New Habit Tracker</span>
              </button>
              <button onClick={() => createPage('reminder')} className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2b] rounded-md transition-colors text-left text-sm cursor-pointer">
                <Plus size={16} /> <span className="font-medium">New Reminder Page</span>
              </button>
              <button onClick={() => setSettingsOpen(true)} className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2b] rounded-md transition-colors text-left text-sm cursor-pointer mt-2">
                <Settings size={16} /> <span className="font-medium">Settings</span>
              </button>
            </div>
          </div>
            <div className="border-t border-[#2d2d2d] bg-[#252526]">
              <UserProfile />
            </div>
          </div>

        {/* MOBILE VIEW */}
        <div className="flex md:hidden flex-col h-full overflow-hidden bg-[#121212]">
           <div className="pt-12 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 bg-[#2a2a2b] rounded-full px-5 py-2">
                 <span className="font-bold text-[15px] text-white">Home</span>
              </div>
              <div className="flex items-center gap-5 text-gray-400">
                 <button><Calendar size={22} /></button>
                 <button><MoreHorizontal size={22} /></button>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto px-4 mt-2">
              {/* RECENTS CAROUSEL */}
              <div className="mb-8">
                 <div className="flex items-center justify-between mb-4 text-gray-400 font-semibold text-[15px]">
                   <span>Recents</span>
                   <ChevronDown size={16} />
                 </div>
                 <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x -mx-4 px-4">
                   {activePages.map(page => (
                     <Link 
                       key={`mobile-recent-${page.id}`} 
                       href={`/page/${page.id}`}
                       className="shrink-0 w-[140px] h-[150px] bg-[#1e1e1e] rounded-xl overflow-hidden border border-[#2d2d2d] flex flex-col snap-start shadow-sm"
                     >
                       <div className="h-[90px] w-full bg-[#2a2a2b] relative overflow-hidden border-b border-[#2d2d2d]">
                          {page.coverImage && (
                             <img src={page.coverImage.url} className="w-full h-full object-cover" style={{ objectPosition: `50% ${page.coverImage.position || 50}%` }} alt="" />
                          )}
                       </div>
                       <div className="p-3 flex items-center gap-2 flex-1 bg-[#222]">
                          {page.type === 'note' ? (
                            <FileText size={18} className="text-gray-400 shrink-0" />
                          ) : page.type === 'habit' ? (
                            <CalendarCheck2 size={18} className="text-[#51b151] shrink-0" />
                          ) : (
                            <Bell size={18} className="text-purple-400 shrink-0" />
                          )}
                          <span className="font-bold text-[13px] text-gray-200 truncate">{page.title}</span>
                       </div>
                     </Link>
                   ))}
                 </div>
              </div>
              {/* PRIVATE LIST */}
              <div className="mb-4">
                 <div className="flex items-center justify-between mb-2 text-gray-400 font-semibold text-[15px]">
                   <span>Private</span>
                   <MoreHorizontal size={16} />
                 </div>
                 <div className="flex flex-col gap-1">
                    {activePages.map(page => (
                       <Link 
                         key={`mobile-private-${page.id}`} 
                         href={`/page/${page.id}`}
                         className="flex items-center gap-4 py-3.5 px-2 active:bg-[#2a2a2b] rounded-xl transition-colors"
                       >
                         {page.type === 'note' ? (
                           <FileText size={22} className="text-gray-400 shrink-0" />
                         ) : page.type === 'habit' ? (
                           <CalendarCheck2 size={22} className="text-[#51b151] shrink-0" />
                         ) : (
                           <Bell size={22} className="text-purple-400 shrink-0" />
                         )}
                         <span className="font-bold text-[16px] text-gray-100 flex-1 truncate">{page.title}</span>
                       </Link>
                    ))}
                 </div>
              </div>
           </div>
           {/* BOTTOM TAB BAR */}
           <div className="border-t border-[#2d2d2d] bg-[#161616] pt-3 pb-6 flex justify-between items-center px-8 relative">
              <button className="flex flex-col items-center gap-1.5 text-gray-400">
                <Search size={22} />
              </button>
              <button className="flex flex-col items-center gap-1.5 text-gray-400">
                <Sparkles size={22} />
              </button>
              <div className="w-12 h-12"></div> {/* Spacer for floating FAB */}
           </div>
           
           {/* Floating FAB */}
           <div className="absolute bottom-4 right-6 flex flex-col gap-3">
              <button onClick={() => setSettingsOpen(true)} className="bg-[#2a2a2b] p-3.5 rounded-full text-white shadow-xl flex items-center justify-center">
                 <Settings size={24} />
              </button>
              <button onClick={() => createPage('note')} className="bg-[#2383e2] p-3.5 rounded-full text-white shadow-xl flex items-center justify-center">
                 <Edit2 size={24} />
              </button>
           </div>
        </div>
      </aside>

      {/* Floating Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#2f2f2f] border border-[#3e3e3eb3] shadow-2xl rounded-md py-1.5 text-[13px] text-gray-200 min-w-[240px] flex flex-col"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.page.deletedAt ? (
            <>
              <div className="px-3 py-1 text-xs text-gray-400 font-medium tracking-wide">Trash Options</div>
              <button onClick={() => handleOptionAction('restore', contextMenu.page)} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#454550] transition-colors text-left text-green-400">
                Restore Page
              </button>
              <div className="my-1 border-t border-[#444] w-full" />
              <button onClick={() => handleOptionAction('permanent-delete', contextMenu.page)} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#454550] transition-colors text-left text-red-400">
                <Trash2 size={14} /> Permanently Delete
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-1 text-xs text-gray-400 font-medium tracking-wide">Database</div>
              
              <button onClick={() => handleOptionAction('favorite', contextMenu.page)} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#454550] transition-colors text-left">
                <Star size={14} className={contextMenu.page.isFavorite ? "text-yellow-400 fill-yellow-400" : "text-gray-400"}/> 
                {contextMenu.page.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
              </button>
              
              <div className="my-1 border-t border-[#444] w-full" />
              
              <button onClick={() => handleOptionAction('copy-link', contextMenu.page)} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#454550] transition-colors text-left">
                <Link2 size={14} className="text-gray-400"/> Copy link
              </button>
              
              <button onClick={() => handleOptionAction('duplicate', contextMenu.page)} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#454550] transition-colors text-left group">
                <Copy size={14} className="text-gray-400"/>
                <span className="flex-1">Duplicate</span>
                <ChevronRight size={14} className="text-gray-500 group-hover:text-gray-300" />
              </button>
              
              <button onClick={() => handleOptionAction('rename', contextMenu.page)} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#454550] transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Edit2 size={14} className="text-gray-400"/> Rename
                </div>
                <span className="text-xs text-gray-500">Ctrl+Shift+R</span>
              </button>
              
              <button onClick={() => handleOptionAction('trash', contextMenu.page)} className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#454550] transition-colors text-left">
                <Trash2 size={14} className="text-gray-400"/> Move to Trash
              </button>

              <div className="my-1 border-t border-[#444] w-full" />

              <button onClick={() => handleOptionAction('new-tab', contextMenu.page)} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#454550] transition-colors text-left">
                <div className="flex items-center gap-3">
                  <ExternalLink size={14} className="text-gray-400"/> Open in new tab
                </div>
                <span className="text-xs text-gray-500">Ctrl+Enter</span>
              </button>
              
              <button onClick={() => handleOptionAction('side-peek', contextMenu.page)} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#454550] transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Columns size={14} className="text-gray-400"/> Open in side peek
                </div>
                <span className="text-xs text-gray-500">Alt+Click</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// Minimal missing lucide-react chevron right fallback
const ChevronRight = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);

const ChevronDown = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);
