// src\context\WorkspaceContext.tsx
import React, { createContext, useState } from 'react';

export const WorkspaceContext = createContext();

export const useWorkspace = () => {
  return useContext(WorkspaceContext);
};

export const WorkspaceProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    // Example setting related to streak tracking
    enableStreaks: true,
  });

  return (
    <WorkspaceContext.Provider value={{ settings, setSettings }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
