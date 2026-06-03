'use client';

import React from 'react';
// @ts-ignore
import { Editor } from '@tiptap/react';
import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus';
import { 
  Bold, Italic, Underline, Strikethrough, 
  Highlighter, Square 
} from 'lucide-react';
import { ColorDropdown } from './EditorUtils';

const SafeTiptapBubbleMenu = TiptapBubbleMenu as any;

export function BubbleMenu({ editor }: { editor: Editor }) {
  if (!editor) return null;

  return (
    <>
      <SafeTiptapBubbleMenu 
        editor={editor} 
        tippyOptions={{ duration: 100 }}
        className="flex items-center gap-1 bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-xl p-1 select-none"
      >
        <button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()} 
          className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:bg-[#37373d]'}`}
        >
          <Bold size={14} />
        </button>
        <button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:bg-[#37373d]'}`}
        >
          <Italic size={14} />
        </button>
        <button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()} 
          className={`p-1.5 rounded transition-colors ${editor.isActive('underline') ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:bg-[#37373d]'}`}
        >
          <Underline size={14} />
        </button>

        <div className="w-[1px] h-4 bg-[#3e3e3e] mx-1" />

        <ColorDropdown 
          label={<Highlighter size={14} className="text-gray-400" />} 
          onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()} 
          indicatorColor="#ffff00"
          showNoColor={true}
        />

        <ColorDropdown 
          label={<span className="text-xs font-bold text-gray-200">A</span>} 
          onSelect={(c) => editor.chain().focus().setColor(c).run()} 
          indicatorColor="#ff0000"
        />

        <ColorDropdown 
          label={<Square size={14} className="text-blue-400" />} 
          onSelect={(c) => editor.chain().focus().setMark('textStyle', { webkitTextStroke: `1px ${c}`, color: 'transparent' }).run()} 
          indicatorColor="#2383e2"
        />
      </SafeTiptapBubbleMenu>
    </>
  );
}
