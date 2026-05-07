import React from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';

export default function CalendarPage() {
  return (
    <main className="flex-1 h-full overflow-hidden">
      <CalendarView />
    </main>
  );
}
