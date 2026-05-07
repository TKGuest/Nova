'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface CalendarContextType {
  currentDate: Date;
  viewDate: Date;
  nextMonth: () => void;
  prevMonth: () => void;
  setToday: () => void;
  selectDate: (date: Date) => void;
  selectedDate: Date;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  const prevMonth = () => setViewDate(subMonths(viewDate, 1));
  const setToday = () => setViewDate(new Date());
  const selectDate = (date: Date) => setSelectedDate(date);

  return (
    <CalendarContext.Provider value={{ 
      currentDate, 
      viewDate, 
      nextMonth, 
      prevMonth, 
      setToday,
      selectDate,
      selectedDate
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  return context;
}
