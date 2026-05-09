'use client';

import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { WordToolbar } from './WordToolbar';
import { SlashCommandMenu } from './SlashCommandMenu';
import suggestion from './suggestion';
import SlashCommand from './SlashCommand';
import ToggleList, { ToggleHeader, ToggleContent } from './ToggleExtension';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface WordEditorProps {
  pageId: string;
  isPeek?: boolean;
}

export function WordEditor({ pageId, isPeek = false }: WordEditorProps) {
  const { user } = useAuth();

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Type "/" for commands',
      }),
      SlashCommand.configure({
        suggestion,
      }),
      ToggleList,
      ToggleHeader,
      ToggleContent,
      Subscript,
      Superscript,
    ],
    content: '',
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (!user || !pageId) return;
      
      // Debounced Local-First Sync
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'pages', pageId), { 
            content: html,
            updatedAt: Date.now() 
          });
        } catch (err) {
          console.error("Save failed:", err);
        }
      }, 300); // 300ms debounce as requested
    },
  });

  // Load content (Optimistic & Ignore sync-back while typing)
  useEffect(() => {
    if (!user || !pageId || !editor) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid, 'pages', pageId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Only update if not focused and content differs significantly
        // This prevents 'locking' when the editor briefly loses focus
        if (!editor.isFocused && !saveTimeout.current && data.content !== editor.getHTML()) {
          editor.commands.setContent(data.content || '', false);
        }
      }
    });

    return () => {
      unsub();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [user, pageId, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col bg-[#1e1e1e] tiptap-editor">
      <WordToolbar editor={editor} />
      
      <div className={`flex-1 ${isPeek ? 'overflow-y-auto' : ''} px-6 md:px-20 py-10 overscroll-behavior-y-contain touch-action-pan-y`}>
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden p-1 gap-1">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive('bold') ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><Bold size={14}/></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive('italic') ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><Italic size={14}/></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive('underline') ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><UnderlineIcon size={14}/></button>
          <div className="w-px bg-[#3a3a3a] mx-1" />
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive({ textAlign: 'left' }) ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><AlignLeft size={14}/></button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive({ textAlign: 'center' }) ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><AlignCenter size={14}/></button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive({ textAlign: 'right' }) ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><AlignRight size={14}/></button>
        </BubbleMenu>
        <EditorContent editor={editor} className="outline-none text-gray-200 text-lg leading-relaxed min-h-full" />
      </div>

      <style jsx global>{`
        .ProseMirror {
          outline: none !important;
          min-height: 500px;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #666;
          pointer-events: none;
          height: 0;
        }
        /* Lists */
        .tiptap-editor ul, .tiptap-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap-editor ul { list-style-type: disc; }
        .tiptap-editor ol { list-style-type: decimal; }
        .tiptap-editor li p { margin: 0; }
        
        /* Task List */
        .tiptap-editor ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .tiptap-editor ul[data-type="taskList"] li {
          display: flex;
          align-items: start;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .tiptap-editor ul[data-type="taskList"] input[type="checkbox"] {
          margin-top: 0.4rem;
          cursor: pointer;
        }
        .tiptap-editor ul[data-type="taskList"] li[data-checked="true"] > div {
          text-decoration: line-through;
          opacity: 0.6;
        }

        /* Toggle List */
        .toggle-list {
          display: flex;
          align-items: flex-start;
          margin: 0.25rem 0;
          position: relative;
        }
        .toggle-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          flex-shrink: 0;
        }
        .toggle-icon {
          cursor: pointer;
          color: #888;
          font-size: 10px;
          transition: transform 0.2s ease;
          user-select: none;
        }
        .toggle-list.is-open .toggle-icon {
          transform: rotate(90deg);
        }
        .toggle-wrapper {
          flex: 1;
        }
        .toggle-header {
          padding: 2px 0;
          min-height: 1.5rem;
          display: flex;
          align-items: center;
          outline: none;
        }
        .toggle-content {
          visibility: hidden;
          height: 0;
          overflow: hidden;
          padding-left: 0.5rem;
          margin-top: 2px;
        }
        .toggle-list.is-open .toggle-content {
          visibility: visible;
          height: auto;
          overflow: visible;
        }
        /* Placeholder shows when content is truly empty OR has only one empty paragraph */
        .toggle-content:empty::before,
        .toggle-content > p:first-child:last-child.is-empty::before {
          content: 'Empty toggle. Click or drop blocks inside.';
          color: #9B9B9B;
          font-size: 0.9em;
          pointer-events: none;
          display: block;
        }
      `}</style>
    </div>
  );
}
