'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  Palette, Highlighter, Type, 
  List, ListOrdered, AlignLeft, 
  AlignCenter, AlignRight, Eraser, 
  Superscript, Subscript, Square, CheckSquare, Play,
  ChevronDown
} from 'lucide-react';
import { ColorDropdown } from './EditorUtils';

const PRESET_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

export function WordToolbar({ 
  editor,
  defaultFontFamily = 'Arial',
  defaultFontSize = '16',
  onDefaultFontFamilyChange,
  onDefaultFontSizeChange
}: { 
  editor: Editor;
  defaultFontFamily?: string;
  defaultFontSize?: string;
  onDefaultFontFamilyChange?: (font: string) => void;
  onDefaultFontSizeChange?: (size: string) => void;
}) {
  if (!editor) return null;

  const [showPresets, setShowPresets] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive the active font family and font size from current editor state
  const activeFontFamily = editor.getAttributes('textStyle').fontFamily || defaultFontFamily;
  let activeFontSize = editor.getAttributes('textStyle').fontSize || '';
  if (activeFontSize && typeof activeFontSize === 'string' && activeFontSize.endsWith('px')) {
    activeFontSize = activeFontSize.replace('px', '');
  }
  if (!activeFontSize) {
    activeFontSize = defaultFontSize;
  }

  const [inputValue, setInputValue] = useState(activeFontSize);

  // Sync state whenever the editor's active selection style changes
  useEffect(() => {
    setInputValue(activeFontSize);
  }, [activeFontSize]);

  // Handle clicking outside the custom font-size combobox dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFontFamilyChange = (font: string) => {
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    editor.chain().focus().setFontFamily(font).run();
    if (!hasSelection) {
      onDefaultFontFamilyChange?.(font);
    }
  };

  const handleFontSizeChange = (size: string) => {
    if (!size || isNaN(Number(size))) return;
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
    if (!hasSelection) {
      onDefaultFontSizeChange?.(size);
    }
  };

  return (
    <div className="sticky top-0 z-[100] bg-[#252526] border-b border-[#3e3e3e] flex flex-col p-1 select-none shadow-md">
      {/* Top Row: Font & Size */}
      <div className="flex items-center gap-2 px-2 py-1">
        <select 
          onChange={(e) => handleFontFamilyChange(e.target.value)}
          value={activeFontFamily}
          className="bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs text-gray-300 min-w-[140px] outline-none hover:border-gray-500 focus:border-purple-500 transition-colors cursor-pointer"
        >
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
        </select>
        
        <div ref={dropdownRef} className="relative flex items-center">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFontSizeChange(inputValue);
                editor.commands.focus();
              }
            }}
            onBlur={() => {
              handleFontSizeChange(inputValue);
            }}
            className="bg-[#1e1e1e] border border-[#3e3e3e] border-r-0 rounded-l px-1.5 py-0.5 text-xs text-gray-300 w-[38px] text-center outline-none hover:border-gray-500 focus:border-purple-500 transition-colors"
            title="Font Size"
          />
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="bg-[#1e1e1e] border border-[#3e3e3e] hover:bg-[#2d2d30] rounded-r px-1 py-1 text-gray-400 hover:text-white transition-colors h-[24px] flex items-center justify-center border-l-0 outline-none cursor-pointer"
            title="Select Font Size Preset"
          >
            <ChevronDown size={12} />
          </button>

          {showPresets && (
            <div className="absolute top-full left-0 mt-1 w-[58px] bg-[#1c1c1e] border border-[#2d2d30] rounded shadow-2xl z-[200] max-h-48 overflow-y-auto custom-scrollbar">
              {PRESET_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setInputValue(size.toString());
                    handleFontSizeChange(size.toString());
                    setShowPresets(false);
                    editor.commands.focus();
                  }}
                  className={`w-full text-left px-2 py-1 text-xs hover:bg-purple-500/20 hover:text-white transition-colors cursor-pointer ${
                    activeFontSize === size.toString() ? 'bg-purple-500/10 text-purple-400 font-bold' : 'text-gray-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

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
      className={`p-1.5 rounded transition-colors ${active ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:bg-[#37373d] hover:text-gray-200'}`}
    >
      {icon}
    </button>
  );
}
