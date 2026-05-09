import { Editor } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleToggle: () => ReturnType;
  }

  interface RawCommands {
    toggleToggle: () => any;
  }
}
