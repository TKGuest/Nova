'use client';

import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  Palette, Highlighter, Type, 
  List, ListOrdered, AlignLeft, 
  AlignCenter, AlignRight, Eraser, 
  Superscript, Subscript, Square, CheckSquare, Play
} from 'lucide-react';
import { ColorDropdown } from './EditorUtils';

export function WordToolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;

  return (
    <div className="sticky top-0 z-[100] bg-[#252526] border-b border-[#3e3e3e] flex flex-col p-1 select-none shadow-md">
      {/* Top Row: Font & Size */}
      <div className="flex items-center gap-2 px-2 py-1">
        <select 
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          defaultValue="Arial"
          className="bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1 py-0.5 text-xs text-gray-300 min-w-[140px] outline-none hover:border-gray-500"
        >
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri (Body)</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
        </select>
        
        <input 
          type="number"
          defaultValue={11}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value;
              editor.chain().focus().setMark('textStyle', { fontSize: `${val}px` }).run();
            }
          }}
          className="bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1 py-0.5 text-xs text-gray-300 w-[50px] outline-none hover:border-gray-500"
        />

        <div className="w-[1px] h-6 bg-[#3e3e3e] mx-1" />
        
        <button className="p-1.5 hover:bg-[#37373d] rounded text-gray-400" title="Change Case">Aa</button>
        <button onClick={() => editor.chain().focus().unsetAllMarks().run()} className="p-1.5 hover:bg-[#37373d] rounded text-gray-400" title="Clear All Formatting"><Eraser size={16} /></button>
      </div>

      {/* Bottom Row: Styles & Colors */}
      <div className="flex items-center gap-1 px-2 py-1">
        <ToolbarButton 
          icon={<Bold size={16}/>} 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          active={editor.isActive('bold')} 
        />
        <ToolbarButton 
          icon={<Italic size={16}/>} 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          active={editor.isActive('italic')} 
        />
        <ToolbarButton 
          icon={<Underline size={16}/>} 
          onClick={() => editor.chain().focus().toggleUnderline().run()} 
          active={editor.isActive('underline')} 
        />
        <ToolbarButton 
          icon={<Strikethrough size={16}/>} 
          onClick={() => editor.chain().focus().toggleStrike().run()} 
          active={editor.isActive('strike')} 
        />
        
        <div className="w-[1px] h-6 bg-[#3e3e3e] mx-1" />
        
        <ToolbarButton 
          icon={<Subscript size={16}/>} 
          onClick={() => (editor.chain().focus() as any).toggleSubscript?.().run()} 
          active={editor.isActive('subscript')} 
        />
        <ToolbarButton 
          icon={<Superscript size={16}/>} 
          onClick={() => (editor.chain().focus() as any).toggleSuperscript?.().run()} 
          active={editor.isActive('superscript')} 
        />
        
        <div className="w-[1px] h-6 bg-[#3e3e3e] mx-1" />

        <ColorDropdown 
          label={<Highlighter size={16} className="text-gray-400" />} 
          onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()} 
          indicatorColor="#ffff00"
          showNoColor={true}
        />

        <ColorDropdown 
          label={<span className="text-sm font-bold text-gray-200">A</span>} 
          onSelect={(c) => editor.chain().focus().setColor(c).run()} 
          indicatorColor="#ff0000"
        />

        <ColorDropdown 
          label={<Square size={16} className="text-blue-400" />} 
          onSelect={(c) => editor.chain().focus().setMark('textStyle', { webkitTextStroke: `1px ${c}`, color: 'transparent' }).run()} 
          indicatorColor="#2383e2"
          title="Outline"
        />

        <div className="w-[1px] h-6 bg-[#3e3e3e] mx-1" />

        <ToolbarButton 
          icon={<List size={16}/>} 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          active={editor.isActive('bulletList')} 
        />
        <ToolbarButton 
          icon={<ListOrdered size={16}/>} 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          active={editor.isActive('orderedList')} 
        />
        <ToolbarButton 
          icon={<CheckSquare size={16}/>} 
          onClick={() => editor.chain().focus().toggleTaskList().run()} 
          active={editor.isActive('taskList')} 
        />
        <ToolbarButton 
          icon={<Play size={14} className="fill-current"/>} 
          onClick={() => (editor.commands as any).toggleToggle()} 
          active={editor.isActive('toggleList')} 
          title="Toggle List"
        />
        
        <div className="w-[1px] h-6 bg-[#3e3e3e] mx-1" />

        <ToolbarButton icon={<AlignLeft size={16}/>} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} />
        <ToolbarButton icon={<AlignCenter size={16}/>} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} />
        <ToolbarButton icon={<AlignRight size={16}/>} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} />
      </div>
    </div>
  );
}

function ToolbarButton({ icon, onClick, active, title }: { icon: React.ReactNode, onClick?: () => void, active?: boolean, title?: string }) {
  return (
    <button 
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:bg-[#37373d] hover:text-gray-200'}`}
    >
      {icon}
    </button>
  );
}
