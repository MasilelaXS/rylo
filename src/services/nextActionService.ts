// Next-action service — picks the single most-actionable task per project.
// Priority order: not started + earliest non-completed task, weighted by urgency.

import type { Task } from '../types';

const PRIO_WEIGHT: Record<Task['priority'], number> = {
  urgent: 4, high: 3, medium: 2, low: 1,
};

export function nextActionForProject(projectId: string, tasks: Task[]): Task | null {
  const candidates = tasks.filter(
    (t) => t.projectId === projectId && t.status !== 'completed' && t.status !== 'cancelled'
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // Earliest overdue first
    const overdueA = a.dueDate < Date.now() ? 1 : 0;
    const overdueB = b.dueDate < Date.now() ? 1 : 0;
    if (overdueA !== overdueB) return overdueB - overdueA;
    const w = (PRIO_WEIGHT[b.priority] ?? 0) - (PRIO_WEIGHT[a.priority] ?? 0);
    if (w !== 0) return w;
    return a.dueDate - b.dueDate;
  });
  return candidates[0] ?? null;
}
