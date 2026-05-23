// Procrastination heatmap — builds avoidance signals by tag/hour-of-day.

import type { Task } from '../types';

export interface HeatCell {
  dow: number;        // 0..6
  hour: number;       // 0..23
  total: number;
  avoidanceScore: number; // 0..1, higher = more avoided
}

export function buildHeatmap(tasks: Task[]): HeatCell[] {
  const cells: HeatCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells.push({ dow: d, hour: h, total: 0, avoidanceScore: 0 });
    }
  }
  const buckets = new Map<string, { total: number; snoozed: number; missed: number }>();
  for (const t of tasks) {
    const dt = new Date(t.dueDate);
    const key = `${dt.getDay()}-${dt.getHours()}`;
    const b = buckets.get(key) ?? { total: 0, snoozed: 0, missed: 0 };
    b.total++;
    if (t.snoozeCount > 0) b.snoozed++;
    if (t.status !== 'completed' && t.status !== 'cancelled' && t.dueDate < Date.now()) b.missed++;
    buckets.set(key, b);
  }
  for (const cell of cells) {
    const b = buckets.get(`${cell.dow}-${cell.hour}`);
    if (!b || b.total === 0) continue;
    cell.total = b.total;
    cell.avoidanceScore = Math.min(1, (b.snoozed + b.missed * 1.5) / (b.total * 2));
  }
  return cells;
}

export interface TagAvoidance { tag: string; rate: number; total: number; }

export function buildAvoidanceByCategory(tasks: Task[]): TagAvoidance[] {
  const map = new Map<string, { total: number; avoided: number }>();
  for (const t of tasks) {
    const tag = t.category ?? 'general';
    const cur = map.get(tag) ?? { total: 0, avoided: 0 };
    cur.total++;
    if (t.snoozeCount > 0 || (t.status !== 'completed' && t.dueDate < Date.now())) cur.avoided++;
    map.set(tag, cur);
  }
  return Array.from(map.entries())
    .map(([tag, v]) => ({ tag, rate: v.total ? v.avoided / v.total : 0, total: v.total }))
    .sort((a, b) => b.rate - a.rate);
}
