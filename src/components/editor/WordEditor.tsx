'use client';

import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

const SafeBubbleMenu = BubbleMenu as any;
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Link from '@tiptap/extension-link';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';
import { WordToolbar } from './WordToolbar';
import { SlashCommandMenu } from './SlashCommandMenu';
import suggestion from './suggestion';
import SlashCommand from './SlashCommand';
import ToggleList, { ToggleHeader, ToggleContent } from './ToggleExtension';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, AlignLeft, AlignCenter, AlignRight, FileText, Calendar as CalendarIcon, X } from 'lucide-react';

interface WordEditorProps {
  pageId: string;
  isPeek?: boolean;
}

export function WordEditor({ pageId, isPeek = false }: WordEditorProps) {
  const { user } = useAuth();
  const [allPages, setAllPages] = useState<any[]>([]);
  const [editorMentionState, setEditorMentionState] = useState<{
    isOpen: boolean;
    textBeforeMention: string;
    searchInput: string;
    range: { from: number; to: number };
  } | null>(null);

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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-purple-400 hover:underline hover:text-purple-300 font-bold bg-purple-500/10 px-1 py-0.2 rounded border border-purple-500/20 cursor-pointer',
        },
      }),
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

  // Subscribe to all pages so we can suggest them
  useEffect(() => {
    if (!user) return;
    const pagesRef = collection(db, 'users', user.uid, 'pages');
    const unsub = onSnapshot(pagesRef, (snapshot) => {
      setAllPages(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    return () => unsub();
  }, [user]);

  // Handle Mentions dynamically based on latest allPages and selection states
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 50), $from.parentOffset);
      const match = textBefore.match(/@([a-zA-Z0-9_\s-]*)$/);
      
      if (match) {
        const queryText = match[1];
        const hasSpaceImmediately = queryText.startsWith(' ');
        
        // Find if any match exists for this query
        const matches = (allPages || []).filter(
          (p: any) => !p.deletedAt && p.title.toLowerCase().includes(queryText.toLowerCase())
        );

        if (!hasSpaceImmediately && matches.length > 0) {
          const from = $from.pos - queryText.length - 1;
          const to = $from.pos;
          setEditorMentionState({
            isOpen: true,
            textBeforeMention: textBefore.substring(0, textBefore.length - match[0].length),
            searchInput: queryText,
            range: { from, to }
          });
          return;
        }
      }
      setEditorMentionState(null);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, allPages]);

  // Dismiss mention dropdown when user clicks elsewhere
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.editor-mention-dropdown')) {
        return;
      }
      setEditorMentionState(null);
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, []);

  // Helper to obtain current absolute editor viewport coordinates
  const getCursorCoords = () => {
    if (!editor) return null;
    try {
      const { selection } = editor.state;
      return editor.view.coordsAtPos(selection.from);
    } catch {
      return null;
    }
  };

  // Handle direct page redirection on link clicking (crucial for editable mode support)
  useEffect(() => {
    const handleEditorLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('/page/')) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = href;
        }
      }
    };

    document.addEventListener('click', handleEditorLinkClick, true);
    return () => {
      document.removeEventListener('click', handleEditorLinkClick, true);
    };
  }, []);

  // Load content (Optimistic & Ignore sync-back while typing)
  useEffect(() => {
    if (!user || !pageId || !editor) return;

    const unsub = onSnapshot(doc(db, 'users', user.uid, 'pages', pageId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        // Only update if not focused and content differs significantly
        // This prevents 'locking' when the editor briefly loses focus
        if (!editor.isFocused && !saveTimeout.current && data.content !== editor.getHTML()) {
          editor.commands.setContent(data.content || '', false as any);
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
    <div className="flex flex-col bg-[#1e1e1e] tiptap-editor relative">
      <WordToolbar editor={editor} />
      
      {editorMentionState && editorMentionState.isOpen && (() => {
        const coords = getCursorCoords();
        if (!coords) return null;
        return (
          <div 
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              transform: 'translate(12px, -100%)',
            }}
            className="editor-mention-dropdown z-[999] bg-[#1c1c1e] border border-[#2d2d30] rounded-xl shadow-2xl p-2 w-64 flex flex-col gap-2 text-left"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="flex items-center gap-1.5 px-1 py-0.5 border-b border-[#2d2d30] pb-1.5 justify-between">
              <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Link to Page</span>
              <button 
                type="button"
                onClick={() => setEditorMentionState(null)}
                className="p-0.5 hover:bg-white/10 rounded text-gray-500 hover:text-gray-300"
              >
                <X size={10} />
              </button>
            </div>

            <div className="overflow-y-auto max-h-36 space-y-0.5 custom-scrollbar p-0.5">
              {(allPages || [])
                .filter((p: any) => !p.deletedAt && p.title.toLowerCase().includes(editorMentionState.searchInput.toLowerCase()))
                .map((page: any) => {
                  const PageIcon = page.type === 'note' ? FileText : CalendarIcon;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        const { from } = editorMentionState.range;
                        const currentTo = editor.state.selection.to;
                        editor.chain().focus()
                          .insertContentAt({ from, to: currentTo }, `<a href="/page/${page.id}">📄 @${page.title}</a> `)
                          .run();
                        setEditorMentionState(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-purple-500/15 rounded text-left text-gray-300 hover:text-white transition-colors cursor-pointer group"
                    >
                      <PageIcon size={12} className="text-gray-500 group-hover:text-purple-400 shrink-0" />
                      <span className="truncate text-[11.5px] font-semibold">{page.title}</span>
                    </button>
                  );
                })}
              {(allPages || []).filter((p: any) => !p.deletedAt && p.title.toLowerCase().includes(editorMentionState.searchInput.toLowerCase())).length === 0 && (
                <div className="px-2 py-4 text-center text-[10px] text-gray-600">No pages found</div>
              )}
            </div>
          </div>
        );
      })()}

      <div className={`flex-1 ${isPeek ? 'overflow-y-auto' : ''} px-6 md:px-20 py-10 overscroll-behavior-y-contain touch-action-pan-y`}>
        <SafeBubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg shadow-xl overflow-hidden p-1 gap-1">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive('bold') ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><Bold size={14}/></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive('italic') ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><Italic size={14}/></button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive('underline') ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><UnderlineIcon size={14}/></button>
          <div className="w-px bg-[#3a3a3a] mx-1" />
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive({ textAlign: 'left' }) ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><AlignLeft size={14}/></button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive({ textAlign: 'center' }) ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><AlignCenter size={14}/></button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded hover:bg-[#3a3a3a] ${editor.isActive({ textAlign: 'right' }) ? 'text-blue-400 bg-[#3a3a3a]' : 'text-gray-300'}`}><AlignRight size={14}/></button>
        </SafeBubbleMenu>
        <EditorContent editor={editor} className="outline-none text-gray-200 text-lg leading-relaxed min-h-full" />
      </div>

      <style>{`
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
