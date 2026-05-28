// src\components\habits\HabitTracker.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';

const HabitTracker = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState(null);

  useEffect(() => {
    // Load streak data from local storage or database
    if (user) {
      const savedStreak = localStorage.getItem(`streak_${user.id}`);
      const savedLastCompletedDate = localStorage.getItem(`lastCompletedDate_${user.id}`);
      if (savedStreak) setStreak(parseInt(savedStreak, 10));
      if (savedLastCompletedDate) setLastCompletedDate(new Date(savedLastCompletedDate));
    }
  }, [user]);

  const completeHabit = () => {
    const today = new Date();
    if (!lastCompletedDate || isSameDay(today, lastCompletedDate)) {
      // If no streak or same day, increment streak
      setStreak(streak + 1);
    } else {
      // If different day, reset streak to 1
      setStreak(1);
    }
    setLastCompletedDate(today);

    // Save streak data to local storage or database
    if (user) {
      localStorage.setItem(`streak_${user.id}`, streak.toString());
      localStorage.setItem(`lastCompletedDate_${user.id}`, today.toISOString());
    }
  };

  const isSameDay = (date1, date2) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  return (
    <div>
      <h1>Habit Tracker</h1>
      <p>Current Streak: {streak}</p>
      <button onClick={completeHabit}>Complete Habit</button>
    </div>
  );
};

export default HabitTracker;
