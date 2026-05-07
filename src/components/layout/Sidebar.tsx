'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, FileText, CalendarCheck2, MoreHorizontal, Star, Link2, Copy, Edit2, CornerUpRight, Trash2, ExternalLink, Columns, Settings, Calendar } from 'lucide-react';
import { UserProfile } from '@/components/auth/UserProfile';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useNotification } from '@/context/NotificationContext';

export interface PageModel {
  id: string;
  title: string;
  type: 'note' | 'habit';
  createdAt: number;
  isFavorite?: boolean;
  content?: string;
  coverImage?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
  defaultRecordCover?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
}

export function Sidebar() {
  const { user } = useAuth();
  const { setSidePeekPageId, setSettingsOpen } = useWorkspace();
  const { showToast, confirm: customConfirm } = useNotification();
  const [pages, setPages] = useState<PageModel[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, page: PageModel } | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);

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
        router.push(`/page/${noteId}`);
      }
      setPages(fetched);
    });

    return () => unsubscribe();
  }, [user, router]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const createPage = async (type: 'note' | 'habit') => {
    if (!user) return;
    const id = Date.now().toString();
    const newPage: PageModel = {
      id,
      title: type === 'note' ? 'Untitled Note' : 'New Habit Tracker',
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
        title: 'Delete this page?',
        message: `Are you sure you want to move "${page.title}" to the trash? This action can be undone later from your trash folder.`,
        confirmLabel: 'Move to Trash',
        onConfirm: async () => {
          await deleteDoc(doc(db, 'users', user.uid, 'pages', page.id));
          if (pathname === `/page/${page.id}`) router.push('/');
          showToast('Page moved to trash');
        }
      });
    } else if (action === 'copy-link') {
      const url = `${window.location.origin}/page/${page.id}`;
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
      window.open(`/page/${page.id}`, '_blank');
    } else if (action === 'side-peek') {
      setSidePeekPageId(page.id);
    }
  };

  if (!user) return null;

  return (
    <>
      <aside className="w-64 border-r border-[#2d2d2d] bg-[#252526] flex flex-col shrink-0 justify-between h-full relative">
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#2d2d2d] flex items-center justify-between shrink-0">
            <h1 className="font-semibold text-sm select-none truncate opacity-80">Workspace Workspace</h1>
          </div>
          
          <div className="p-2 flex-1 overflow-y-auto">
            {pages.filter(p => p.isFavorite).length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-2 hover:bg-[#2a2a2b] py-1 rounded cursor-pointer transition-colors duration-200 w-fit">
                  Favorites
                </div>
                <nav className="flex flex-col gap-[2px]">
                  {pages.filter(p => p.isFavorite).map(page => (
                    <div 
                      key={page.id} 
                      className={`group relative flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                        pathname === `/page/${page.id}` ? 'bg-[#37373d]' : 'hover:bg-[#2a2a2b]'
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, page)}
                    >
                      <Link href={`/page/${page.id}`} className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0">
                        {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : <CalendarCheck2 size={16} className="text-gray-400 shrink-0" />}
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
              </nav>
            </div>
            
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-2 hover:bg-[#2a2a2b] py-1 rounded cursor-pointer transition-colors duration-200 w-fit">
              Recents
            </div>
            <nav className="flex flex-col gap-[2px]">
              {pages.map(page => (
                <div 
                  key={page.id} 
                  className={`group relative flex items-center justify-between rounded-md transition-colors cursor-pointer ${
                    pathname === `/page/${page.id}` ? 'bg-[#37373d]' : 'hover:bg-[#2a2a2b]'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, page)}
                >
                  {renamingPageId === page.id ? (
                     <div className="flex items-center gap-2 px-3 py-1.5 flex-1 min-w-0">
                       {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : <CalendarCheck2 size={16} className="text-gray-400 shrink-0" />}
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
                      {page.type === 'note' ? <FileText size={16} className="text-gray-400 shrink-0" /> : <CalendarCheck2 size={16} className="text-gray-400 shrink-0" />}
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
              <button onClick={() => setSettingsOpen(true)} className="w-full flex items-center gap-2 px-2 py-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2b] rounded-md transition-colors text-left text-sm cursor-pointer mt-2">
                <Settings size={16} /> <span className="font-medium">Settings</span>
              </button>
            </div>
          </div>
          <div className="border-t border-[#2d2d2d] bg-[#252526]">
            <UserProfile />
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
        </div>
      )}
    </>
  );
}

// Minimal missing lucide-react chevron right fallback
const ChevronRight = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);
