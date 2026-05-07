'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Block, BlockType } from '../../types';
import { BlockNode } from './BlockNode';
import { EditorToolbar } from './EditorToolbar';
import { LexoRank } from 'lexorank';
import { DndContext, closestCenter, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useAuth } from '@/components/auth/AuthProvider';

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  
  // Storage for debouncing character updates
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const updateFirebaseBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    if (!user) return;
    
    if (debounceTimers.current[blockId]) {
      clearTimeout(debounceTimers.current[blockId]);
    }
    
    debounceTimers.current[blockId] = setTimeout(async () => {
      try {
        const ref = doc(db, 'users', user.uid, 'pages', pageId, 'blocks', blockId);
        await setDoc(ref, updates, { merge: true });
        delete debounceTimers.current[blockId];
      } catch (e) {
        console.error(e);
      }
    }, 500);
  }, [pageId, user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'pages', pageId, 'blocks'),
      orderBy('lexoRank', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBlocks = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id
      })) as Block[];
      
      if (fetchedBlocks.length === 0 && !snapshot.metadata.hasPendingWrites) {
        const newBlock = {
          pageId,
          type: 'text' as BlockType,
          content: '',
          lexoRank: LexoRank.middle().toString(),
        };
        const ref = doc(collection(db, 'users', user.uid, 'pages', pageId, 'blocks'));
        setDoc(ref, newBlock);
      } else {
        setBlocks(prev => {
          // Robust mapping to preserve cursor state: if a local text mutation hasn't been saved yet (timer active), 
          // we hold onto the local state and reject the stale remote listener payload for that specific block.
          if (prev.length !== fetchedBlocks.length) return fetchedBlocks;
          
          return fetchedBlocks.map((fb, i) => {
            if (debounceTimers.current[fb.id] && prev.find(p => p.id === fb.id)) {
              return prev.find(p => p.id === fb.id)!;
            }
            return fb;
          });
        });
      }
    });

    return () => unsubscribe();
  }, [pageId, user]);

  const handleUpdateContent = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
    updateFirebaseBlock(id, { content });
  };

  const handleUpdateProperties = (id: string, properties: any) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, properties: { ...b.properties, ...properties } } : b));
    updateFirebaseBlock(id, { properties });
  };

  const handleAddNext = async (currentId: string) => {
    if(!user) return;
    
    const ref = doc(collection(db, 'users', user.uid, 'pages', pageId, 'blocks'));
    let newId = ref.id;
    let newBlock: Block | null = null;
    
    setBlocks(prev => {
      const currentIndex = prev.findIndex(b => b.id === currentId);
      let newLexoRank = '';
      
      if (currentIndex === prev.length - 1) {
        const lastRank = LexoRank.parse(prev[currentIndex].lexoRank);
        newLexoRank = lastRank.genNext().toString();
      } else {
        const currentRank = LexoRank.parse(prev[currentIndex].lexoRank);
        const nextRank = LexoRank.parse(prev[currentIndex + 1].lexoRank);
        newLexoRank = currentRank.between(nextRank).toString();
      }

      newBlock = {
        id: newId,
        pageId,
        type: 'text',
        content: '',
        lexoRank: newLexoRank
      };

      const updated = [...prev];
      updated.splice(currentIndex + 1, 0, newBlock);
      return updated;
    });
    
    setFocusedId(newId);

    if (newBlock) {
      try {
        const ref = doc(db, 'users', user.uid, 'pages', pageId, 'blocks', newId);
        await setDoc(ref, newBlock);
      } catch {}
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    
    let currentIndex = -1;
    setBlocks(prev => {
      currentIndex = prev.findIndex(b => b.id === id);
      if (prev.length <= 1) return prev;
      
      const prevBlock = prev[currentIndex - 1];
      if (prevBlock) {
        setFocusedId(prevBlock.id);
      }
      return prev.filter(b => b.id !== id);
    });
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'pages', pageId, 'blocks', id));
    } catch {}
  };

  const handleChangeType = (id: string, type: BlockType) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, type } : b));
    updateFirebaseBlock(id, { type });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !user) return;

    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);

    const updatedBlocks = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(updatedBlocks);

    let newLexoRank = '';
    if (newIndex === 0) {
      const nextRank = LexoRank.parse(updatedBlocks[1].lexoRank);
      newLexoRank = nextRank.genPrev().toString();
    } else if (newIndex === updatedBlocks.length - 1) {
      const prevRank = LexoRank.parse(updatedBlocks[newIndex - 1].lexoRank);
      newLexoRank = prevRank.genNext().toString();
    } else {
      const prevRank = LexoRank.parse(updatedBlocks[newIndex - 1].lexoRank);
      const nextRank = LexoRank.parse(updatedBlocks[newIndex + 1].lexoRank);
      newLexoRank = prevRank.between(nextRank).toString();
    }

    updateFirebaseBlock(active.id as string, { lexoRank: newLexoRank });
  };

  const firstEmptyBlockId = blocks.find(b => b.type === 'text' && !b.content)?.id;

  return (
    <div className="w-full relative pb-32">
      <EditorToolbar />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-0">
          {blocks.map(block => (
            <BlockNode 
              key={block.id}
              block={block}
              isFirstEmptyBlock={block.id === firstEmptyBlockId}
              isFocused={focusedId === block.id}
              onFocus={setFocusedId}
              onUpdateContent={handleUpdateContent}
              onUpdateProperties={handleUpdateProperties}
              onAddNext={handleAddNext}
              onDelete={handleDelete}
              onTypeChange={handleChangeType}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
    </div>
  );
}
