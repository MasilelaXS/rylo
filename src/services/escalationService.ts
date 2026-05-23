// Escalation decision logic — drives the full-screen "Do it / Reschedule / Cancel" modal.
// When snoozeCount on a pending task crosses the threshold for the user's reminder mode,
// the app should block further easy snoozes and force a deliberate decision.

import type { ReminderMode, Task } from '../types';

const THRESHOLDS: Record<ReminderMode, number> = {
  gentle: 5,
  motivational: 4,
  strict: 3,
  military: 2,
  aggressive: 2,
};

export function snoozeCostMinutes(snoozeCount: number): number {
  // Each successive snooze costs progressively less time — punishes avoidance.
  // 30 → 20 → 10 → 5 → 5 → 5 ...
  if (snoozeCount <= 0) return 30;
  if (snoozeCount === 1) return 20;
  if (snoozeCount === 2) return 10;
  return 5;
}

export function shouldForceDecision(task: Task, mode: ReminderMode): boolean {
  const limit = THRESHOLDS[mode] ?? 3;
  return task.snoozeCount >= limit && task.status !== 'completed' && task.status !== 'cancelled';
}

export function escalationLevelFromSnoozes(snoozeCount: number): number {
  if (snoozeCount >= 6) return 4;
  if (snoozeCount >= 4) return 3;
  if (snoozeCount >= 2) return 2;
  return 1;
}
