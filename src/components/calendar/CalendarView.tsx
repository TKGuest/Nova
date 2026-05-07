'use client';

import React from 'react';
import { useCalendar } from '@/context/CalendarContext';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CalendarView() {
  const { viewDate, nextMonth, prevMonth, setToday, selectDate, selectedDate, currentDate } = useCalendar();

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-200 p-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">{format(viewDate, 'MMMM yyyy')}</h1>
          <div className="flex items-center bg-[#2d2d2d] rounded-md p-1 border border-[#3e3e3e]">
            <button 
              onClick={prevMonth}
              className="p-1 hover:bg-[#3e3e3e] rounded transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={setToday}
              className="px-3 py-1 text-xs font-medium hover:bg-[#3e3e3e] rounded transition-colors"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-1 hover:bg-[#3e3e3e] rounded transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-[#2d2d2d] pb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 flex-1 border-l border-t border-[#2d2d2d]">
          {calendarDays.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, currentDate);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={idx}
                onClick={() => selectDate(day)}
                className={`
                  relative min-h-[100px] p-2 border-r border-b border-[#2d2d2d] cursor-pointer transition-all
                  ${!isCurrentMonth ? 'bg-[#1a1a1a] text-gray-600' : 'hover:bg-[#252526]'}
                  ${isSelected ? 'bg-[#252526] ring-1 ring-inset ring-blue-500/50' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`
                    flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full
                    ${isToday ? 'bg-blue-600 text-white' : ''}
                    ${isSelected && !isToday ? 'bg-[#3e3e3e]' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                {/* Content Area (Items will appear here) */}
                <div className="flex flex-col gap-1 overflow-hidden">
                  {/* Placeholder for relational items */}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
