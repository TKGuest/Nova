import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ToggleNodeView from './ToggleNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleExtension: {
      toggleToggle: () => ReturnType;
    }
  }
}

export const ToggleHeader = Node.create({
  name: 'toggleHeader',
  content: 'inline*',
  parseHTML() { return [{ tag: 'div[data-type="toggle-header"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-header', class: 'toggle-header' }), 0];
  },
});

export const ToggleContent = Node.create({
  name: 'toggleContent',
  content: 'block+',
  parseHTML() { return [{ tag: 'div[data-type="toggle-content"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-content', class: 'toggle-content' }), 0];
  },
});

export default Node.create({
  name: 'toggleList',
  group: 'block',
  content: 'toggleHeader toggleContent',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      isOpen: {
        default: true,
        parseHTML: element => element.getAttribute('data-open') === 'true',
        renderHTML: attributes => ({
          'data-open': attributes.isOpen,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-list"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-list' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleNodeView);
  },

  addCommands() {
    return {
      toggleToggle: () => ({ commands, state }: any) => {
        const { selection } = state;
        const { $from } = selection;
        const node = $from.node($from.depth);
        
        // Check if already inside a toggle
        
        if (this.editor.isActive('toggleList')) {
          return commands.lift('toggleList');
        }

        // Convert current block to toggle
        return commands.insertContent({
          type: 'toggleList',
          attrs: { isOpen: true },
          content: [
            { type: 'toggleHeader', content: node.content.toJSON() },
            { type: 'toggleContent', content: [{ type: 'paragraph' }] }
          ]
        });
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        const node = $from.node($from.depth);
        
        if (node.type.name === 'toggleHeader') {
          const toggleListNode = $from.node($from.depth - 1);
          if (toggleListNode.type.name === 'toggleList') {
            const isOpen = toggleListNode.attrs.isOpen;
            
            if (isOpen) {
              const contentPos = $from.after();
              return editor.commands.focus(contentPos + 2);
            } else {
              const listEndPos = $from.after($from.depth - 1);
              return editor.chain()
                .insertContentAt(listEndPos, { type: 'paragraph' })
                .focus(listEndPos + 1)
                .run();
            }
          }
        }
        return false;
      },
      'Backspace': ({ editor }) => {
        const { selection } = editor.state;
        const { $from, empty } = selection;
        if (!empty) return false;

        const node = $from.node($from.depth);
        
        if (node.type.name === 'toggleHeader' && $from.parentOffset === 0) {
          if (node.content.size === 0) {
            return editor.commands.deleteNode('toggleList');
          }
          return editor.commands.lift('toggleList');
        }

        if (node.type.name === 'paragraph' && node.content.size === 0) {
          const parent = $from.node($from.depth - 1);
          if (parent.type.name === 'toggleContent' && parent.childCount === 1) {
            return editor.commands.focus($from.before($from.depth - 1) - 1);
          }
        }
        
        return false;
      },
    };
  },
});
