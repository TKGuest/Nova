'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Maximize2, X, FileText, CalendarCheck2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageModel } from '@/components/layout/Sidebar';
import { WordEditor } from '@/components/editor/WordEditor';
import { HabitTracker } from '@/components/habits/HabitTracker';

export function SidePeek() {
  const { sidePeekPageId, setSidePeekPageId, sidePeekRecordId, setSidePeekRecordId } = useWorkspace();
  const { user } = useAuth();
  
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 700, height: 800 });
  const [pageData, setPageData] = useState<PageModel | null>(null);
  
  const [isMobile, setIsMobile] = useState(false);
  
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
    } else {
      const width = Math.min(window.innerWidth * 0.8, 900);
      const height = window.innerHeight * 0.85;
      setPosition({
        x: Math.max(50, (window.innerWidth - width) / 2),
        y: Math.max(50, (window.innerHeight - height) / 2)
      });
      setSize({ width, height });
    }
  }, [sidePeekPageId, isMobile]);

  useEffect(() => {
    if (!sidePeekPageId || !user) return;
    
    const fetchPage = async () => {
      const docRef = doc(db, 'users', user.uid, 'pages', sidePeekPageId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
         setPageData({ id: snap.id, ...snap.data() } as PageModel);
      }
    };
    fetchPage();
  }, [sidePeekPageId, user]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || isMobile) return;
    setPosition({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const isOpen = !!sidePeekPageId;
  const isActuallyOpen = isOpen && user;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: isMobile ? '100vw' : size.width,
        height: isMobile ? '100vh' : size.height,
        minWidth: isMobile ? '100vw' : '400px',
        minHeight: isMobile ? '100vh' : '400px',
        transform: `translateX(${isActuallyOpen ? '0%' : '100%'})`,
        visibility: isActuallyOpen ? 'visible' : 'hidden'
      }}
      className={`z-[100] bg-background border border-border shadow-2xl flex flex-col overflow-hidden resize bg-clip-padding ${isMobile ? 'rounded-none' : 'rounded-xl'} transition-transform duration-300`}
      onMouseDown={(e) => e.stopPropagation()} 
    >
      {/* Draggable Header */}
      <div 
        className="h-10 bg-sidebar border-b border-border flex items-center justify-between px-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-xs font-semibold text-gray-400 select-none flex items-center gap-2">
           {pageData?.type === 'note' ? <FileText size={12}/> : <CalendarCheck2 size={12}/>} Side Peek
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => {
              setSidePeekPageId(null);
              setSidePeekRecordId(null);
              window.open(`/page/${sidePeekPageId}`, '_blank');
            }} 
            className="p-1 hover:bg-[#37373d] rounded text-gray-400 hover:text-white transition-colors" title="Open in new tab">
            <Maximize2 size={14}/>
          </button>
          <button onClick={() => { setSidePeekPageId(null); setSidePeekRecordId(null); }} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors" title="Close"><X size={16}/></button>
        </div>
      </div>
      
      {/* Editor Content Area */}
      <div className={`flex-1 overflow-y-auto w-full relative bg-background cursor-auto flex flex-col ${pageData?.type === 'habit' && sidePeekRecordId ? 'p-0' : 'p-8 lg:px-12'}`}>
         {pageData && (
           <>
              {!(pageData.type === 'habit' && sidePeekRecordId) && (
                <h1 className="text-4xl font-bold text-foreground mb-8 cursor-text empty:before:content-['Untitled'] empty:before:text-gray-600 outline-none">
                   {pageData.title}
                </h1>
              )}
              {pageData.type === 'note' ? (
                <WordEditor pageId={sidePeekPageId!} />
              ) : (
                <div className={sidePeekRecordId ? 'mt-0' : 'mt-8'}>
                  <HabitTracker pageId={sidePeekPageId!} isPeek={true} />
                </div>
              )}
           </>
         )}
      </div>
    </div>
  );
}
