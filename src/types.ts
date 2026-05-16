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
  deletedAt?: number;
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

// Gamification Models
export interface HabitStats {
  points: number;
  vaultBalance: number;
  streakMultiplier: number;
  debt: boolean;
  lastDecayDate: string; // ISO string to track point decay
  lastStreakReset: string; 
  pointsEarnedToday?: number; // Inflation control cap
  lastPointGainDate?: string; 
  equippedBuffs: { itemId: string; name: string; expiresAt: number }[];
}

export interface InventoryItem {
  id: string; // "insurance", "holiday", "timer", "note"
  name: string;
  type: 'buff' | 'timer' | 'note' | 'instant';
  quantity: number;
  costPurchased: number; // for compound cost calculation
  customText?: string;
}

export interface SubTask {
  id: string;
  title: string;
  completedAt?: string | null;
}

export interface GamificationTask {
  id: string; // Links to MasterTask ID
  pointsValue: number;
  isBadHabit: boolean;
  maxDailyCompletions: number; // 1 for tickbox, >1 for counter
  subTasks: SubTask[];
  compoundCostModifier: number; // For bad habits 
  scheduleType: 'daily' | 'weekly' | 'event';
}
