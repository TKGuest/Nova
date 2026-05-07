'use client';

import React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { X, Settings2, Moon, Type, Clock } from 'lucide-react';

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings } = useWorkspace();

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
      <div 
        className="bg-[#252526] w-[600px] border border-[#3e3e3e] shadow-2xl rounded-xl flex flex-col overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#3e3e3e] flex items-center justify-between bg-[#1e1e1e]">
          <h2 className="font-semibold text-gray-200 flex items-center gap-2">
            <Settings2 size={18} /> Settings & Workspace Automation
          </h2>
          <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-white"><X size={18}/></button>
        </div>
        
        <div className="p-6 flex flex-col gap-8 flex-1 bg-background select-none">
          
          <section className="flex flex-col gap-3">
            <h3 className="font-medium text-gray-300 flex items-center gap-2"><Type size={16}/> Typography Setup</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-1">Select the global font scaling size across your entire workspace.</p>
            <div className="flex items-center gap-2">
              {(['small', 'default', 'large'] as const).map(sz => (
                <button 
                  key={sz}
                  onClick={() => updateSettings({ fontSize: sz })}
                  className={`px-4 py-2 border rounded font-medium text-sm capitalize transition-colors ${settings.fontSize === sz ? 'bg-[#2383e2] border-[#2383e2] text-white' : 'border-[#454545] text-gray-400 hover:border-gray-200 hover:text-gray-200'}`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </section>

          <hr className="border-[#3e3e3e] w-full" />

          <section className="flex flex-col gap-3">
            <h3 className="font-medium text-gray-300 flex items-center gap-2"><Clock size={16}/> Daily Card Expansion (Automation)</h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[90%]">
              By default, "Today's" daily habit kanban card resets immediately exactly at Midnight local time. 
              If you want the card reset bound to a different hourly boundary (e.g. tracking habits if you stay up until 4am), set the automated cutoff point below.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-gray-300">Daily Reset Automation Hour:</span>
              <select 
                value={settings.resetHour}
                onChange={(e) => updateSettings({ resetHour: parseInt(e.target.value) })}
                className="bg-[#1e1e1e] border border-[#454545] text-gray-300 rounded px-3 py-1 outline-none text-sm focus:border-[#2383e2]"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "12:00 AM (Midnight)" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM (Noon)" : `${i - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
