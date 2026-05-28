import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Task } from '../types';
import { ESCALATION_CONFIG } from '../utils/constants';

// expo-notifications push support was removed from Expo Go in SDK 53.
// To prevent the DevicePushTokenAutoRegistration side-effect from running,
// we NEVER import expo-notifications at the module level. Instead, we lazy-
// require it inside each function, guarded by this Expo Go check.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// Lazily require expo-notifications and configure the foreground handler once.
let _notifications: typeof import('expo-notifications') | null = null;
function N(): typeof import('expo-notifications') {
  if (_notifications) return _notifications;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowList: true,
    }),
  });
  _notifications = Notifications;
  return Notifications;
}

// ─── Request permission ───────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (IS_EXPO_GO) return false;

  const Notifications = N();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E90FF',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('escalation', {
      name: 'Escalation Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#FF4444',
      sound: 'default',
      bypassDnd: true,
    });
    await Notifications.setNotificationChannelAsync('hourly', {
      name: 'Hourly Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: '#1E90FF',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('due-tasks', {
      name: 'Task Due Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400, 200, 800],
      lightColor: '#FF4444',
      sound: 'default',
      bypassDnd: true,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Schedule due-task alert with follow-up vibrations until acknowledged ─────
export async function scheduleTaskDueAlert(task: Task): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = N();
  if (task.dueDate <= Date.now()) return;

  const followUpBodies = [
    task.description || 'This task is due. Mark it In Progress, Done, or Snooze.',
    'Due 5m ago — mark In Progress, Done, or Snooze.',
    'Due 10m ago — still awaiting your response.',
    'Due 15m ago — please take an action.',
    'Due 20m ago — don\'t let this slip.',
    'Due 25m ago — final reminder.',
  ];

  for (let i = 0; i <= 5; i++) {
    const triggerMs = task.dueDate + i * 5 * 60 * 1000;
    if (triggerMs <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i === 0 ? `⏰ Due now: ${task.title}` : `⏰ Still pending: ${task.title}`,
        body: followUpBodies[i],
        data: { taskId: task.id, type: 'task-due', repeatIndex: i },
        sound: 'default',
        categoryIdentifier: 'task-reminder',
        ...(Platform.OS === 'android' && { channelId: 'due-tasks', largeIcon: 'drawer' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerMs),
      },
    });
  }
}

// Backward-compat alias used by tasks.tsx, calendar.tsx, templates.tsx, etc.
export async function scheduleTaskReminder(task: Task): Promise<string | null> {
  await scheduleTaskDueAlert(task);
  return null;
}

// ─── Schedule escalation notification ────────────────────────────────────────
export async function scheduleEscalation(task: Task, escalationLevel: number): Promise<void> {
  if (IS_EXPO_GO) return;

  const Notifications = N();
  const config = ESCALATION_CONFIG.find((c) => c.level === escalationLevel);
  if (!config) return;

  const triggerMs = Date.now() + config.intervalMin * 60 * 1000;
  const urgencyMap: Record<number, string> = { 1: '🔔', 2: '🔊', 3: '🚨', 4: '🆘' };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${urgencyMap[escalationLevel] ?? '⚠️'} ${task.title}`,
      body: `Escalation Level ${escalationLevel}: ${config.label}. This task is still incomplete.`,
      data: { taskId: task.id, escalationLevel },
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'escalation', largeIcon: 'drawer' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerMs),
    },
  });
}

// ─── Cancel all scheduled notifications for a task ───────────────────────────
export async function cancelTaskNotifications(taskId: string): Promise<void> {
  if (IS_EXPO_GO) return;

  const Notifications = N();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.taskId === taskId) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

// ─── Cancel all notifications ────────────────────────────────────────────────
export async function cancelAllNotifications(): Promise<void> {
  if (IS_EXPO_GO) return;

  const Notifications = N();
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Diagnostic: fire a test notification in N seconds ───────────────────────
// Returns a human-readable status string so the UI can show what actually
// happened (permission denied, channel missing, scheduled OK, etc).
export async function sendTestNotification(delaySec: number = 5): Promise<string> {
  if (IS_EXPO_GO) return 'Not supported in Expo Go — install the built APK.';

  const Notifications = N();

  // 1. Permission check
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== 'granted') {
      return 'Permission denied. Open Android Settings → Apps → Rylo → Notifications and allow them.';
    }
  }

  // 2. Ensure the channel exists (no-op on iOS)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E90FF',
      sound: 'default',
    });
  }

  // 3. Schedule
  const trigger = new Date(Date.now() + Math.max(1, delaySec) * 1000);
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Test notification',
        body: `If you see this, notifications are working. (${delaySec}s test)`,
        data: { type: 'test' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'reminders', largeIcon: 'drawer' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
    return `Scheduled (id ${id.slice(0, 6)}…). Lock the screen and wait ${delaySec}s. If nothing fires, the OS is killing background work — open Battery optimisation and whitelist Rylo.`;
  } catch (err: unknown) {
    return `Schedule failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Diagnostic: how many notifications are queued + permission status ───────
export async function getNotificationStatus(): Promise<{
  permission: string;
  scheduledCount: number;
  channelImportance?: number;
}> {
  if (IS_EXPO_GO) return { permission: 'expo-go', scheduledCount: 0 };
  const Notifications = N();
  const perm = await Notifications.getPermissionsAsync();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  let channelImportance: number | undefined;
  if (Platform.OS === 'android') {
    const ch = await Notifications.getNotificationChannelAsync('reminders');
    channelImportance = ch?.importance;
  }
  return { permission: perm.status, scheduledCount: scheduled.length, channelImportance };
}


// ─── Schedule morning & evening daily briefing notifications ─────────────────
export async function scheduleDailyBriefings(tasks: Task[]): Promise<void> {
  if (IS_EXPO_GO) return;

  const Notifications = N();

  let morningEnabled    = true;
  let eveningEnabled    = true;
  let morningTime       = '08:00';
  let eveningTime       = '20:00';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSettingsStore } = require('../store/settingsStore') as typeof import('../store/settingsStore');
    const { settings } = useSettingsStore.getState();
    morningEnabled = settings.morningBriefingEnabled ?? true;
    eveningEnabled = settings.eveningBriefingEnabled ?? true;
    morningTime    = settings.morningBriefingTime   ?? '08:00';
    eveningTime    = settings.eveningBriefingTime   ?? '20:00';
  } catch { /* defaults */ }

  // Cancel existing daily briefings
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.content.data?.type === 'daily-briefing') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const overdue = tasks.filter((t) => t.dueDate < Date.now() && t.status !== 'completed' && t.status !== 'cancelled');

  const scheduleFor = async (timeStr: string, label: 'morning' | 'evening') => {
    const [h, m] = timeStr.split(':').map(Number);
    const trigger = new Date();
    trigger.setHours(h, m, 0, 0);
    // If the time has already passed today, schedule for tomorrow
    if (trigger.getTime() <= Date.now()) trigger.setDate(trigger.getDate() + 1);

    const titles: Record<string, string> = {
      morning: `☀️ Good morning — ${pending.length} task${pending.length !== 1 ? 's' : ''} today`,
      evening: `🌙 Evening wrap-up — ${pending.length} task${pending.length !== 1 ? 's' : ''} remaining`,
    };
    const bodies: Record<string, string> = {
      morning: overdue.length > 0
        ? `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} need attention. Tap to review.`
        : 'Have a productive day! Tap to see your schedule.',
      evening: overdue.length > 0
        ? `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} still overdue. Don't let them slip further.`
        : 'Great work today! Review tomorrow\'s agenda.',
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: titles[label],
        body: bodies[label],
        data: { type: 'daily-briefing', briefingType: label },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'reminders', largeIcon: 'drawer' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
  };

  if (morningEnabled) await scheduleFor(morningTime, 'morning');
  if (eveningEnabled) await scheduleFor(eveningTime, 'evening');
}


function isQuietHour(hour: number, start: string, end: string): boolean {
  const [sh] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  // Handles overnight ranges e.g. 22:00 → 07:00
  return sh > eh
    ? hour >= sh || hour < eh
    : hour >= sh && hour < eh;
}

// ─── Register notification action categories ──────────────────────────────────
export async function registerNotificationCategories(): Promise<void> {
  if (IS_EXPO_GO) return;
  const Notifications = N();
  await Notifications.setNotificationCategoryAsync('task-reminder', [
    {
      identifier: 'start',
      buttonTitle: '▶️ In Progress',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'complete',
      buttonTitle: '✅ Done',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'snooze30',
      buttonTitle: '😴 Snooze 30m',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

// ─── Handle notification action responses ────────────────────────────────────
export function setupNotificationResponseHandler(): () => void {
  if (IS_EXPO_GO) return () => {};
  const Notifications = N();

  const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const { taskId } = response.notification.request.content.data ?? {};
    const actionId = response.actionIdentifier;
    if (!taskId) return;

    // Immediately cancel any queued follow-up notifications for this task
    await cancelTaskNotifications(taskId as string);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useTaskStore } = require('../store/taskStore') as typeof import('../store/taskStore');
      const store = useTaskStore.getState();

      if (actionId === 'complete') {
        await store.markComplete(taskId as string);
      } else if (actionId === 'start') {
        await store.editTask({ id: taskId as string, status: 'in_progress' });
      } else if (actionId === 'snooze30') {
        const snoozeUntil = Date.now() + 30 * 60 * 1000;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { updateTask: dbUpdateTask } = require('../database/tasks') as typeof import('../database/tasks');
        const task = store.tasks.find((t) => t.id === taskId);
        await dbUpdateTask({
          id: taskId as string,
          status: 'snoozed',
          dueDate: snoozeUntil,
          snoozeCount: (task?.snoozeCount ?? 0) + 1,
        });
        // Re-arm the repeating due alert at the new snooze time
        if (task) {
          await scheduleTaskDueAlert({ ...task, status: 'snoozed', dueDate: snoozeUntil });
        }
        await store.loadAll();
      }
    } catch { /* store not ready */ }
  });

  return () => sub.remove();
}

export async function scheduleHourlyReminders(tasks: Task[]): Promise<void> {
  if (IS_EXPO_GO) return;

  const Notifications = N();

  // Read settings without importing at module level (avoids circular deps)
  let hourlyEnabled = true;
  let quietEnabled  = true;
  let quietStart    = '22:00';
  let quietEnd      = '07:00';
  let userName      = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSettingsStore } = require('../store/settingsStore') as typeof import('../store/settingsStore');
    const { settings } = useSettingsStore.getState();
    hourlyEnabled = settings.hourlyRemindersEnabled ?? true;
    quietEnabled  = settings.quietHoursEnabled      ?? true;
    quietStart    = settings.quietHoursStart        ?? '22:00';
    quietEnd      = settings.quietHoursEnd          ?? '07:00';
    userName      = settings.userName?.trim()       ?? '';
  } catch { /* settings not yet initialised — use defaults */ }

  // Cancel existing hourly summaries
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.content.data?.type === 'hourly-summary') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (!hourlyEnabled) return;

  const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  if (pending.length === 0) return;

  const greeting = userName ? `Hey ${userName}` : 'Hey';

  // Schedule one notification per hour for the next 24 hours.
  for (let h = 1; h <= 24; h++) {
    const triggerDate = new Date();
    triggerDate.setMinutes(0, 0, 0);
    triggerDate.setHours(triggerDate.getHours() + h);

    const hour = triggerDate.getHours();

    // Respect quiet hours
    if (quietEnabled && isQuietHour(hour, quietStart, quietEnd)) continue;

    const windowStart = triggerDate.getTime();
    const windowEnd   = windowStart + 2 * 3_600_000; // 2-hour lookahead window

    const overdueCount  = pending.filter((t) => t.dueDate < windowStart).length;
    const upcomingInWin = pending
      .filter((t) => t.dueDate >= windowStart && t.dueDate < windowEnd)
      .sort((a, b) => a.dueDate - b.dueDate);

    // Nearest task at or after this trigger time
    const nextTask = pending
      .filter((t) => t.dueDate >= windowStart)
      .sort((a, b) => a.dueDate - b.dueDate)[0];

    // Build title: "Hey Pieter, it's 3:00 PM"
    const hourNum   = hour % 12 || 12;
    const ampm      = hour < 12 ? 'AM' : 'PM';
    const timeLabel = `${hourNum}:00 ${ampm}`;
    const title     = `${greeting}, it's ${timeLabel}`;

    // Build body: counts + next task
    const parts: string[] = [];
    if (upcomingInWin.length > 0)
      parts.push(`${upcomingInWin.length} task${upcomingInWin.length > 1 ? 's' : ''} coming up`);
    if (overdueCount > 0)
      parts.push(`${overdueCount} overdue`);

    let body: string;
    if (parts.length === 0 && nextTask) {
      // No imminent tasks but something is ahead
      const nextTime = new Date(nextTask.dueDate)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      body = `Next: ${nextTask.title} at ${nextTime}`;
    } else if (parts.length > 0) {
      body = parts.join(', ');
      if (nextTask) {
        const nextTime = new Date(nextTask.dueDate)
          .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        body += `  ·  Next: ${nextTask.title} at ${nextTime}`;
      }
    } else {
      continue; // nothing to report this hour
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'hourly-summary' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'hourly', largeIcon: 'drawer' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  }
}

