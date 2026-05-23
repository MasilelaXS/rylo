import { create } from 'zustand';
import { recordCompletion } from '../database/categoryStreaks';
import {
    completeTask,
    deleteTask,
    getAllTasks,
    getOverdueTasks,
    getTodaysTasks,
    insertTask,
    updateTask,
} from '../database/tasks';
import { shouldForceDecision } from '../services/escalationService';
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

  // ── UI-level pending prompts (consumed by GlobalModalsHost) ────────────
  pendingExcuseTaskId: string | null;
  pendingDecisionTaskId: string | null;
  pendingFollowUpTaskId: string | null;
  pendingCallConfirmTaskId: string | null;

  loadAll: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Partial<Task> & { id: string }) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  markComplete: (id: string) => Promise<void>;
  snoozeTask: (id: string) => Promise<{ decisionRequired: boolean }>;
  forceCancel: (id: string) => Promise<void>;
  rescheduleBy: (id: string, minutes: number) => Promise<void>;
  clearPending: (kind: 'excuse' | 'decision' | 'followUp' | 'callConfirm') => void;
  requestCallConfirm: (id: string) => void;

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

  pendingExcuseTaskId: null,
  pendingDecisionTaskId: null,
  pendingFollowUpTaskId: null,
  pendingCallConfirmTaskId: null,

  clearPending: (kind) => set((s) => {
    if (kind === 'excuse')      return { ...s, pendingExcuseTaskId: null };
    if (kind === 'decision')    return { ...s, pendingDecisionTaskId: null };
    if (kind === 'followUp')    return { ...s, pendingFollowUpTaskId: null };
    if (kind === 'callConfirm') return { ...s, pendingCallConfirmTaskId: null };
    return s;
  }),

  requestCallConfirm: (id) => set({ pendingCallConfirmTaskId: id }),

  forceCancel: async (id) => {
    await updateTask({ id, status: 'cancelled' });
    await get().loadAll();
  },

  rescheduleBy: async (id, minutes) => {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    await updateTask({
      id,
      status: 'snoozed',
      snoozeCount: t.snoozeCount + 1,
      dueDate: Date.now() + minutes * 60_000,
    });
    await get().loadAll();
  },

  loadAll: async () => {
    set({ loading: true });
    try {
      const [all, today, overdue] = await Promise.all([
        getAllTasks(),
        getTodaysTasks(),
        getOverdueTasks(),
      ]);
      set({ tasks: all, todayTasks: today, overdueTasks: overdue, loading: false });
    } catch (err) {
      console.error('[taskStore.loadAll]', err);
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
    await get().loadAll();
  },

  markComplete: async (id) => {
    const before = get().tasks.find((t) => t.id === id);
    await completeTask(id);

    // Spawn next occurrence for recurring tasks
    const task = before;
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

    // Per-category streak
    try {
      await recordCompletion(task?.category ?? 'general');
    } catch { /* table may not exist yet on cold start */ }

    // Update legacy global streak in settingsStore
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

    // Follow-up prompt for communication tasks
    if (task?.category === 'communication') {
      set({ pendingFollowUpTaskId: id });
    }

    await get().loadAll();
  },

  snoozeTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return { decisionRequired: false };

    // Reminder mode from settings (controls escalation threshold)
    let mode: import('../types').ReminderMode = 'strict';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useSettingsStore } = require('./settingsStore') as typeof import('./settingsStore');
      mode = useSettingsStore.getState().settings.reminderMode ?? 'strict';
    } catch { /* default */ }

    // Increment-only check against threshold (don't push the due date yet —
    // the user must justify the snooze first).
    const projected: Task = { ...task, snoozeCount: task.snoozeCount + 1 };
    if (shouldForceDecision(projected, mode)) {
      set({ pendingDecisionTaskId: id });
      return { decisionRequired: true };
    }

    // Cost-of-snooze: progressively shorter snoozes punish avoidance.
    const minutes = task.snoozeCount === 0 ? 30 : task.snoozeCount === 1 ? 20 : task.snoozeCount === 2 ? 10 : 5;
    await updateTask({
      id,
      status: 'snoozed',
      snoozeCount: task.snoozeCount + 1,
      dueDate: Date.now() + minutes * 60 * 1000,
    });
    set({ pendingExcuseTaskId: id });
    await get().loadAll();
    return { decisionRequired: false };
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
