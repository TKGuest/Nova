'use client';

import React from 'react';
import { Palette, Eraser } from 'lucide-react';

export const THEME_COLORS = [
  '#ffffff', '#000000', '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646'
];

export const STANDARD_COLORS = [
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'
];

export function ColorDropdown({ label, onSelect, indicatorColor, showNoColor, title }: { label: React.ReactNode, onSelect: (c: string) => void, indicatorColor: string, showNoColor?: boolean, title?: string }) {
  return (
    <div className="relative group">
      <button className="p-1.5 hover:bg-[#37373d] rounded flex flex-col items-center gap-0" title={title}>
        {label}
        <div className="w-4 h-1 rounded-full" style={{ backgroundColor: indicatorColor }} />
      </button>
      
      <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-[1000] bg-[#252526] border border-[#3e3e3e] rounded shadow-2xl p-3 min-w-[200px]">
        {showNoColor && (
          <button 
            onClick={() => onSelect('transparent')}
            className="w-full flex items-center gap-2 p-1 hover:bg-[#37373d] rounded text-xs text-gray-300 mb-2"
          >
            <Eraser size={12} /> No Color
          </button>
        )}

        <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Theme Colors</div>
        <div className="grid grid-cols-10 gap-1 mb-3">
          {THEME_COLORS.map(c => (
            <div key={c} onClick={() => onSelect(c)} className="w-4 h-4 rounded-sm cursor-pointer hover:scale-125 border border-white/10" style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Standard Colors</div>
        <div className="grid grid-cols-10 gap-1 mb-3">
          {STANDARD_COLORS.map(c => (
            <div key={c} onClick={() => onSelect(c)} className="w-4 h-4 rounded-sm cursor-pointer hover:scale-125 border border-white/10" style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="relative flex items-center gap-2 p-1 hover:bg-[#37373d] rounded cursor-pointer mt-1 border-t border-[#3e3e3e] pt-2">
           <Palette size={12} className="text-gray-400" />
           <span className="text-xs text-gray-300">More Colors...</span>
           <input type="color" onChange={(e) => onSelect(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        </div>
      </div>
    </div>
  );
}
