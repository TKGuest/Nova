'use client';

export type BlockType = 
  | 'text' 
  | 'h1' | 'h2' | 'h3' | 'h4' 
  | 'checkbox' | 'bullet' | 'number' | 'toggle' 
  | 'page' | 'callout' | 'quote' | 'table' | 'divider' | 'link'
  | 'image' | 'video' | 'audio' | 'code' | 'file'
  | 'database';

export interface Block {
  id: string;
  pageId: string;
  type: BlockType;
  content: string;
  properties?: Record<string, any>;
  lexoRank: string;
  parentId?: string | null;
}

export interface PageModel {
  id: string;
  title: string;
  type: 'note' | 'habit';
  createdAt: number;
  isFavorite?: boolean;
  content?: string;
  coverImage?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
  defaultRecordCover?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
}

export interface WorkspacePage {
  id: string;
  userId: string;
  title: string;
  icon?: string;
  coverImage?: string;
  parentId?: string | null;
  createdAt: number;
  updatedAt: number;
}
