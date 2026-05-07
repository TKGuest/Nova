import React, { useEffect, useRef, useState } from 'react';
import { Block, BlockType } from '@/types';
import { GripVertical, ChevronRight, File as FileIcon, FileImage, FileVideo, FileAudio, FileCode, Paperclip, Quote } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SlashCommandMenu } from './SlashCommandMenu';
import { DatabaseBlock } from './DatabaseBlock';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BlockNodeProps {
  block: Block;
  isFocused: boolean;
  isFirstEmptyBlock?: boolean;
  onUpdateContent: (id: string, content: string) => void;
  onUpdateProperties: (id: string, properties: any) => void;
  onAddNext: (id: string) => void;
  onDelete: (id: string) => void;
  onTypeChange: (id: string, type: BlockType) => void;
  onFocus: (id: string) => void;
}

export function BlockNode({
  block,
  isFocused,
  isFirstEmptyBlock,
  onUpdateContent,
  onUpdateProperties,
  onAddNext,
  onDelete,
  onTypeChange,
  onFocus
}: BlockNodeProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(block.content);
  const [showMenu, setShowMenu] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (block.type === 'database') {
    return (
      <div ref={setNodeRef} style={style} className="group relative py-1 w-full">
        <DatabaseBlock databaseId={block.id} />
      </div>
    );
  }

  useEffect(() => {
    if (editorRef.current && block.content !== html) {
      if (document.activeElement !== editorRef.current) {
        setHtml(block.content);
        editorRef.current.innerHTML = block.content;
      }
    }
  }, [block.content, html]);

  useEffect(() => {
    if (isFocused && editorRef.current && !isDragging) {
      editorRef.current.focus();
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        if (sel) {
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (e) {}
    }
  }, [isFocused, isDragging]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const htmlContent = (e.target as HTMLDivElement).innerHTML;
    const textContent = (e.target as HTMLDivElement).innerText;
    setHtml(htmlContent);
    onUpdateContent(block.id, htmlContent);
    
    if (textContent === '/') setShowMenu(true);
    else setShowMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMenu) {
      e.preventDefault();
      onAddNext(block.id);
    }
    if (e.key === 'Backspace') {
      const text = e.currentTarget.textContent || '';
      if (text === '' || text === '\n') {
        e.preventDefault();
        onDelete(block.id);
      }
    }
  };

  const renderPrefix = () => {
    switch(block.type) {
      case 'checkbox':
        return (
          <div className="mr-2 mt-[6px] flex-shrink-0 text-accent hover:text-white" onClick={() => onUpdateProperties(block.id, { checked: !block.properties?.checked })}>
            <Checkbox checked={!!block.properties?.checked} />
          </div>
        );
      case 'bullet': return <span className="mr-3 font-bold text-lg">•</span>;
      case 'number': return <span className="mr-3 font-bold text-gray-500">1.</span>;
      case 'toggle': return <button type="button" className="mr-1 mt-1 flex-shrink-0 text-gray-400"><ChevronRight size={20} /></button>;
      case 'quote': return <div className="w-1 h-[90%] bg-white rounded-full mr-4 self-center flex-shrink-0" />;
      case 'page': return <FileIcon size={20} className="mr-3 text-gray-400 mt-0.5" />;
      case 'link': return <span className="mr-3 text-gray-400 hover:underline cursor-pointer">↗</span>;
      default: return null;
    }
  };

  // Setup wrapper stylings depending on complex boundary types
  const isWrapperBlock = ['callout', 'code', 'quote', 'divider', 'image', 'video', 'audio', 'file'].includes(block.type);

  const textClass = cn(
    "min-h-[24px] outline-none flex-grow w-full empty:before:content-[attr(data-placeholder)] empty:before:text-gray-500",
    {
      "text-3xl font-bold mt-6 mb-2": block.type === 'h1',
      "text-2xl font-bold mt-5 mb-1": block.type === 'h2',
      "text-xl font-bold mt-4 mb-1": block.type === 'h3',
      "text-lg font-bold mt-3 mb-1": block.type === 'h4',
      "line-through text-gray-500": block.type === 'checkbox' && block.properties?.checked,
      "text-gray-300 font-medium italic": block.type === 'quote',
      "font-mono text-sm text-green-400": block.type === 'code',
      "border-b border-gray-600 pb-2 mb-2 w-full": block.type === 'divider',
    }
  );

  return (
    <div ref={setNodeRef} style={style} className="group relative flex items-start py-[2px] transition-colors rounded-sm">
      {block.type === 'divider' ? (
        <div className="w-full h-px bg-[#3e3e3e] my-3 relative group-hover:bg-[#5a5a5a] cursor-pointer" onClick={() => onFocus(block.id)} />
      ) : (
        <div className={`relative flex-grow w-full flex ${block.type === 'callout' ? 'bg-[#252526] border border-[#3e3e3e] p-4 rounded-md' : ''} ${block.type === 'code' ? 'bg-[#1e1e1e] border border-[#2d2d2d] p-4 rounded-md' : ''}`}>
          
          {renderPrefix()}

          <div className="relative flex-grow w-full block">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={block.type === 'text' ? (isFirstEmptyBlock ? "Type '/' for commands" : "") : block.type === 'code' ? "console.log('Hello World');" : `${block.type}...`}
              className={textClass}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => onFocus(block.id)}
            />
            {showMenu && (
              <SlashCommandMenu 
                onClose={() => setShowMenu(false)}
                onSelect={(type) => {
                  onTypeChange(block.id, type);
                  onUpdateContent(block.id, '');
                  setHtml('');
                  if (editorRef.current) { editorRef.current.innerText = ''; }
                  setShowMenu(false);
                  onFocus(block.id);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
