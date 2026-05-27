import { create } from 'zustand';
import {
    deleteMoodLog,
    getAllMoodLogs,
    getMoodLogsSince,
    upsertMoodLog,
} from '../database/moodLogs';
import type { MoodLog } from '../types';
import { generateId } from '../utils/constants';

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface MoodStore {
  logs: MoodLog[];
  todayLog: MoodLog | null;
  loadAll: () => Promise<void>;
  loadSince: (since: string) => Promise<void>;
  saveLog: (energy: number, mood: number, note: string, date?: string) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
}

export const useMoodStore = create<MoodStore>((set, get) => ({
  logs:     [],
  todayLog: null,

  loadAll: async () => {
    const logs    = await getAllMoodLogs();
    const today   = toIsoDate(new Date());
    const todayLog = logs.find((l) => l.logDate === today) ?? null;
    set({ logs, todayLog });
  },

  loadSince: async (since: string) => {
    const logs    = await getMoodLogsSince(since);
    const today   = toIsoDate(new Date());
    const todayLog = logs.find((l) => l.logDate === today) ?? null;
    set({ logs, todayLog });
  },

  saveLog: async (energy, mood, note, date) => {
    const logDate  = date ?? toIsoDate(new Date());
    const existing = get().logs.find((l) => l.logDate === logDate);
    const log: MoodLog = {
      id:        existing?.id ?? generateId(),
      logDate,
      energy,
      mood,
      note,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await upsertMoodLog(log);
    await get().loadAll();
  },

  removeLog: async (id) => {
    await deleteMoodLog(id);
    await get().loadAll();
  },
}));
