import { create } from 'zustand';
import {
    completeTask,
    deleteTask,
    getAllTasks,
    getOverdueTasks,
    getTodaysTasks,
    insertTask,
    updateTask,
} from '../database/tasks';
import type { DailyStats, Task } from '../types';
import { generateId } from '../utils/constants';

// Returns the next due date for a recurring task after its original due date
function nextDueDate(task: Task): number {
  const d = new Date(task.dueDate);
  switch (task.repeatType) {
    case 'daily':   d.setDate(d.getDate() + 1); break;
    case 'weekly':  d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    default: return 0;
  }
  return d.getTime();
}

interface WeeklyBar {
  label: string;       // "Mon"
  total: number;
  completed: number;
}

interface TaskStore {
  tasks: Task[];
  todayTasks: Task[];
  overdueTasks: Task[];
  loading: boolean;

  loadAll: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Partial<Task> & { id: string }) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  markComplete: (id: string) => Promise<void>;
  snoozeTask: (id: string) => Promise<void>;
  getDailyStats: () => DailyStats;
  getWeeklyBars: () => WeeklyBar[];
  getAvoidanceTasks: () => Task[];   // tasks with snoozeCount >= 3 or severely overdue
  getEstimatedMinutesToday: () => number;
}

export { WeeklyBar };

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  todayTasks: [],
  overdueTasks: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const [tasks, todayTasks, overdueTasks] = await Promise.all([
        getAllTasks(),
        getTodaysTasks(),
        getOverdueTasks(),
      ]);
      set({ tasks, todayTasks, overdueTasks, loading: false });
    } catch (e) {
      console.error('[TaskStore] loadAll failed:', e);
      set({ loading: false });
    }
  },

  addTask: async (task) => {
    await insertTask(task);
    await get().loadAll();
  },

  editTask: async (task) => {
    await updateTask(task);
    await get().loadAll();
  },

  removeTask: async (id) => {
    await deleteTask(id);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      todayTasks: s.todayTasks.filter((t) => t.id !== id),
      overdueTasks: s.overdueTasks.filter((t) => t.id !== id),
    }));
  },

  markComplete: async (id) => {
    await completeTask(id);

    // Spawn next occurrence for recurring tasks
    const task = get().tasks.find((t) => t.id === id);
    if (task && task.repeatType !== 'none') {
      const nd = nextDueDate(task);
      if (nd > 0) {
        const next: Task = {
          ...task,
          id: generateId(),
          status: 'pending',
          dueDate: nd,
          snoozeCount: 0,
          escalationLevel: 0,
          createdAt: Date.now(),
          completedAt: undefined,
        };
        await insertTask(next);
      }
    }

    // Update streak in settingsStore
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useSettingsStore } = require('./settingsStore') as typeof import('./settingsStore');
      const { settings, update } = useSettingsStore.getState();
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastStr  = settings.lastCompletionDate ?? '';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);

      let streak = settings.currentStreak ?? 0;
      if (lastStr === todayStr) {
        // already counted today, no change
      } else if (lastStr === yStr) {
        streak += 1;
      } else {
        streak = 1; // reset
      }
      update({
        currentStreak: streak,
        longestStreak: Math.max(streak, settings.longestStreak ?? 0),
        lastCompletionDate: todayStr,
      });
    } catch { /* settings not ready */ }

    await get().loadAll();
  },

  snoozeTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await updateTask({
      id,
      status: 'snoozed',
      snoozeCount: task.snoozeCount + 1,
      dueDate: task.dueDate + 30 * 60 * 1000, // +30min
    });
    await get().loadAll();
  },

  getDailyStats: () => {
    const { tasks } = get();
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(now.setHours(23, 59, 59, 999)).getTime();
    const today = tasks.filter((t) => t.dueDate >= startOfDay && t.dueDate <= endOfDay);

    return {
      total: today.length,
      completed: today.filter((t) => t.status === 'completed').length,
      overdue: today.filter((t) => t.dueDate < Date.now() && t.status !== 'completed').length,
      pending: today.filter((t) => t.status === 'pending' || t.status === 'snoozed').length,
    };
  },

  getWeeklyBars: () => {
    const { tasks } = get();
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      const dayTasks = tasks.filter((t) => t.dueDate >= start.getTime() && t.dueDate <= end.getTime());
      return {
        label: DAY_LABELS[d.getDay()],
        total: dayTasks.length,
        completed: dayTasks.filter((t) => t.status === 'completed').length,
      };
    });
  },

  getAvoidanceTasks: () => {
    const { tasks } = get();
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 3600 * 1000;
    return tasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.status !== 'cancelled' &&
        (t.snoozeCount >= 3 || (t.dueDate < now - twoDaysMs))
    ).sort((a, b) => b.snoozeCount - a.snoozeCount);
  },

  getEstimatedMinutesToday: () => {
    const { tasks } = get();
    const now = new Date();
    const start = new Date(now).setHours(0, 0, 0, 0);
    const end   = new Date(now).setHours(23, 59, 59, 999);
    return tasks
      .filter((t) => t.dueDate >= start && t.dueDate <= end && t.status !== 'completed')
      .reduce((acc, t) => acc + (t.estimatedMinutes ?? 0), 0);
  },
}));
