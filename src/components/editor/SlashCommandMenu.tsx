import React, { useEffect, useRef } from 'react';
import { BlockType } from '../../types';
import { Type, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, CheckSquare, ChevronRight, File, MessageSquare, Quote, Table as TableIcon, Minus, Link as LinkIcon, Image, Video, Mic, Code, Paperclip } from 'lucide-react';

interface SlashCommandMenuProps {
  onClose: () => void;
  onSelect: (type: BlockType) => void;
}

type CommandItem = {
  id: string;
  type?: BlockType;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  isHeader?: boolean;
};

const COMMANDS: CommandItem[] = [
  { id: 'h_basic', label: 'Basic blocks', isHeader: true },
  { id: '1', type: 'text', label: 'Text', sub: 'Just start writing with plain text.', icon: <Type size={18} /> },
  { id: '6', type: 'bullet', label: 'Bulleted list', sub: 'Create a simple bulleted list.', icon: <List size={18} /> },
  { id: '7', type: 'number', label: 'Numbered list', sub: 'Create a list with numbering.', icon: <ListOrdered size={18} /> },
  { id: '8', type: 'checkbox', label: 'To-do list', sub: 'Track tasks with a to-do list.', icon: <CheckSquare size={18} /> },
  { id: '9', type: 'toggle', label: 'Toggle list', sub: 'Toggles can hide and show content inside.', icon: <ChevronRight size={18} /> },
  
  { id: '10', type: 'page', label: 'Page', sub: 'Embed a sub-page inside this page.', icon: <File size={18} /> },
  { id: '14', type: 'divider', label: 'Divider', sub: 'Visually divide blocks.', icon: <Minus size={18} /> },

  { id: 'h_media', label: 'Media', isHeader: true },
  { id: '16', type: 'image', label: 'Image', sub: 'Upload or embed with a link.', icon: <Image size={18} /> },
  { id: '17', type: 'video', label: 'Video', sub: 'Embed from YouTube, Vimeo...', icon: <Video size={18} /> },
  { id: '18', type: 'audio', label: 'Audio', sub: 'Embed from Spotify, Soundcloud...', icon: <Mic size={18} /> },
  { id: '19', type: 'code', label: 'Code', sub: 'Capture a code snippet.', icon: <Code size={18} /> },
  { id: '20', type: 'file', label: 'File', sub: 'Upload any file you want.', icon: <Paperclip size={18} /> },
];

export function SlashCommandMenu({ onClose, onSelect }: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      className="w-80 bg-[#252526] border border-[#2d2d2d] rounded-md shadow-2xl z-50 max-h-80 overflow-y-auto"
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="py-2">
        {COMMANDS.map((cmd) => {
          if (cmd.isHeader) {
            return (
              <div key={cmd.id} className="px-4 py-2 mt-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                {cmd.label}
              </div>
            );
          }
          return (
            <button
              key={cmd.id}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#37373d] text-left transition-colors group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if(cmd.type) onSelect(cmd.type);
              }}
            >
              <div className="p-2 border border-[#2d2d2d] bg-[#1e1e1e] rounded flex items-center justify-center text-gray-300 group-hover:bg-[#252526]">
                {cmd.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">{cmd.label}</span>
                {cmd.sub && <span className="text-xs text-gray-500">{cmd.sub}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
