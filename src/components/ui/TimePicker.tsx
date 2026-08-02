'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:MM" in 24-hour format
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  className?: string;
  buttonClassName?: string;
}

export function TimePicker({
  value,
  onChange,
  label,
  disabled = false,
  align = 'left',
  className = '',
  buttonClassName = ''
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minListRef = useRef<HTMLDivElement>(null);

  // Parse 24h time
  const [hourStr, minStr] = (value || '09:00').split(':');
  const activeHour = isNaN(parseInt(hourStr, 10)) ? 9 : parseInt(hourStr, 10);
  const activeMin = isNaN(parseInt(minStr, 10)) ? 0 : parseInt(minStr, 10);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active elements into view when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const activeHourBtn = hourListRef.current?.querySelector('[data-active="true"]');
        const activeMinBtn = minListRef.current?.querySelector('[data-active="true"]');
        activeHourBtn?.scrollIntoView({ block: 'center' });
        activeMinBtn?.scrollIntoView({ block: 'center' });
      }, 10);
    }
  }, [isOpen]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleHourSelect = (h: number) => {
    const newTime = `${String(h).padStart(2, '0')}:${String(activeMin).padStart(2, '0')}`;
    onChange(newTime);
  };

  const handleMinSelect = (m: number) => {
    const newTime = `${String(activeHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    onChange(newTime);
  };

  const formattedDisplay = `${String(activeHour).padStart(2, '0')}:${String(activeMin).padStart(2, '0')}`;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[9px] font-black uppercase text-gray-400 tracking-wider mb-1 block">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#111] border border-[#2d2d2d] rounded-lg px-3 py-2 text-white font-mono font-bold text-xs text-left flex items-center justify-between hover:border-purple-500 hover:bg-[#161616] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="tracking-widest">{formattedDisplay}</span>
        <Clock size={13} className="text-gray-400 shrink-0 ml-1.5" />
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 bg-[#141416] border border-[#2d2d2d] rounded-2xl shadow-2xl p-3 flex gap-2 z-[100] text-xs w-[185px] select-none h-56 animate-fadeIn`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hours Column */}
          <div className="flex-1 flex flex-col min-w-[65px] h-full">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 text-center mb-1.5 shrink-0">
              HR
            </span>
            <div
              ref={hourListRef}
              className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded space-y-0.5 pr-0.5"
            >
              {hours.map((h) => {
                const isSelected = activeHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    data-active={isSelected ? 'true' : 'false'}
                    onClick={() => handleHourSelect(h)}
                    className={`w-full py-1 text-center font-mono font-black text-[12px] rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow shadow-purple-600/30'
                        : 'text-gray-400 hover:bg-[#222] hover:text-white'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-[1px] bg-[#222] my-1 shrink-0" />

          {/* Minutes Column */}
          <div className="flex-1 flex flex-col min-w-[65px] h-full">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 text-center mb-1.5 shrink-0">
              MIN
            </span>
            <div
              ref={minListRef}
              className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#333] [&::-webkit-scrollbar-thumb]:rounded space-y-0.5 pr-0.5"
            >
              {minutes.map((m) => {
                const isSelected = activeMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    data-active={isSelected ? 'true' : 'false'}
                    onClick={() => handleMinSelect(m)}
                    className={`w-full py-1 text-center font-mono font-black text-[12px] rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow shadow-purple-600/30'
                        : 'text-gray-400 hover:bg-[#222] hover:text-white'
                    }`}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
