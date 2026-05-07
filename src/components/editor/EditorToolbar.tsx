'use client';

import React from 'react';
import { Bold, Italic, Underline, Strikethrough, Palette, Type, Highlighter } from 'lucide-react';

export function EditorToolbar() {
  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    // Focus is usually maintained, but we can force update
  };

  const applyOutline = () => {
    // There is no native execCommand for webkit-text-stroke.
    // We wrap the selection in a span with the style.
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const span = document.createElement('span');
    span.style.webkitTextStroke = '1px #2383e2';
    span.style.color = 'transparent';
    span.className = 'text-outline-active';
    
    const range = selection.getRangeAt(0);
    range.surroundContents(span);
  };

  return (
    <div className="flex items-center gap-1 p-2 mb-6 bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-sm w-fit sticky top-4 z-50">
      <ToolbarButton icon={<Bold size={16}/>} onClick={() => applyFormat('bold')} tooltip="Bold" />
      <ToolbarButton icon={<Italic size={16}/>} onClick={() => applyFormat('italic')} tooltip="Italic" />
      <ToolbarButton icon={<Underline size={16}/>} onClick={() => applyFormat('underline')} tooltip="Underline" />
      <ToolbarButton icon={<Strikethrough size={16}/>} onClick={() => applyFormat('strikeThrough')} tooltip="Strikethrough" />
      
      <div className="w-[1px] h-4 bg-[#3e3e3e] mx-2" />
      
      {/* Color Pickers (Using native execCommand for text color) */}
      <div className="relative group flex items-center">
        <ToolbarButton icon={<Palette size={16}/>} tooltip="Text Color" />
        <input 
          type="color" 
          onChange={(e) => applyFormat('foreColor', e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          title="Choose Color"
        />
      </div>

      {/* Font Size */}
      <div className="flex items-center gap-1 mx-2">
        <Type size={14} className="text-gray-400"/>
        <select 
          onChange={(e) => applyFormat('fontSize', e.target.value)}
          className="bg-transparent text-sm text-gray-300 outline-none border-none cursor-pointer"
        >
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>
      </div>
      
      <div className="w-[1px] h-4 bg-[#3e3e3e] mx-2" />
      
      {/* Outline */}
      <ToolbarButton icon={<Highlighter size={16}/>} onClick={applyOutline} tooltip="Add Blue Outline" />
    </div>
  );
}

function ToolbarButton({ icon, onClick, tooltip }: { icon: React.ReactNode, onClick?: () => void, tooltip: string }) {
  return (
    <button 
      onClick={(e) => {
        e.preventDefault(); // Prevent losing focus from the text block
        onClick?.();
      }}
      title={tooltip}
      className="p-1.5 text-gray-400 hover:text-white hover:bg-[#37373d] rounded transition-colors"
    >
      {icon}
    </button>
  );
}
