'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth/AuthProvider';

export interface UserSettings {
  fontSize: 'small' | 'default' | 'large';
  resetHour: number; // 0-23 (e.g. 4 for 4am)
}

interface WorkspaceContextType {
  sidePeekPageId: string | null;
  setSidePeekPageId: (id: string | null) => void;
  sidePeekRecordId: string | null;
  setSidePeekRecordId: (id: string | null) => void;
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const defaultSettings: UserSettings = {
  fontSize: 'default',
  resetHour: 0,
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sidePeekPageId, setSidePeekPageId] = useState<string | null>(null);
  const [sidePeekRecordId, setSidePeekRecordId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const docRef = doc(db, 'users', user.uid, 'settings', 'prefs');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() });
      }
    };
    fetchSettings();
  }, [user]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    const docRef = doc(db, 'users', user.uid, 'settings', 'prefs');
    await setDoc(docRef, updated, { merge: true });
  };

  return (
    <WorkspaceContext.Provider value={{
      sidePeekPageId,
      setSidePeekPageId,
      sidePeekRecordId,
      setSidePeekRecordId,
      settings,
      updateSettings,
      isSettingsOpen,
      setSettingsOpen
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
