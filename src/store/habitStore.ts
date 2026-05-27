import { create } from 'zustand';
import {
    deleteHabit,
    getAllCompletionsSince,
    getAllHabits,
    insertHabit,
    toggleCompletion,
    updateHabit,
} from '../database/habits';
import type { Habit } from '../types';
import { generateId } from '../utils/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Computes current and longest streak from a set of completed ISO dates. */
export function computeStreak(completedSet: Set<string>): {
  current: number;
  longest: number;
} {
  const today = toIsoDate(new Date());
  const hasTodayDone = completedSet.has(today);

  // Current: walk backward from today (or yesterday if today not yet marked)
  let current = 0;
  const start = hasTodayDone ? 0 : 1;
  for (let i = start; i < 365; i++) {
    const key = toIsoDate(new Date(Date.now() - i * 86_400_000));
    if (completedSet.has(key)) {
      current++;
    } else {
      break;
    }
  }

  // Longest: scan all sorted dates for consecutive runs
  const sorted = Array.from(completedSet).sort();
  let longest = current;
  let temp = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { temp = 1; continue; }
    const diff =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) /
      86_400_000;
    temp = diff === 1 ? temp + 1 : 1;
    if (temp > longest) longest = temp;
  }

  return { current, longest };
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface HabitWithStats {
  habit: Habit;
  streak: number;
  longestStreak: number;
  completedDates: Set<string>; // last 60 days
  todayDone: boolean;
}

interface HabitStore {
  habits: HabitWithStats[];
  loading: boolean;
  loadAll: () => Promise<void>;
  toggle: (habitId: string, date: string) => Promise<void>;
  add: (data: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
  edit: (id: string, data: Partial<Omit<Habit, 'id' | 'createdAt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const SINCE_DAYS = 60;

// ─── Store ───────────────────────────────────────────────────────────────────
export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const since = toIsoDate(new Date(Date.now() - SINCE_DAYS * 86_400_000));
    const [rawHabits, allCompletions] = await Promise.all([
      getAllHabits(),
      getAllCompletionsSince(since),
    ]);

    const completionsByHabit = new Map<string, Set<string>>();
    for (const c of allCompletions) {
      const s = completionsByHabit.get(c.habitId) ?? new Set<string>();
      s.add(c.completedDate);
      completionsByHabit.set(c.habitId, s);
    }

    const today = toIsoDate(new Date());
    const habits: HabitWithStats[] = rawHabits.map((habit) => {
      const completedDates = completionsByHabit.get(habit.id) ?? new Set<string>();
      const { current, longest } = computeStreak(completedDates);
      return {
        habit,
        streak: current,
        longestStreak: longest,
        completedDates,
        todayDone: completedDates.has(today),
      };
    });

    set({ habits, loading: false });
  },

  toggle: async (habitId, date) => {
    await toggleCompletion(habitId, date);
    await get().loadAll();
  },

  add: async (data) => {
    const habit: Habit = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
      archived: false,
    };
    await insertHabit(habit);
    await get().loadAll();
  },

  edit: async (id, data) => {
    await updateHabit({ id, ...data });
    await get().loadAll();
  },

  remove: async (id) => {
    await deleteHabit(id);
    await get().loadAll();
  },
}));
