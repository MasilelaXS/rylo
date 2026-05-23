// Excuse-log service — wraps DB ops and pattern detection.

import { getAllExcuses, getExcusePatterns, insertExcuse } from '../database/excuses';
import type { Excuse } from '../types';
import { generateId } from '../utils/constants';

const KEYWORDS: { category: string; matches: RegExp }[] = [
  { category: 'tired',      matches: /tired|exhaust|sleep|drained/i },
  { category: 'no time',    matches: /no time|busy|swamped|overload/i },
  { category: 'afraid',     matches: /afraid|scared|anxious|nervous|fear/i },
  { category: 'unclear',    matches: /unclear|don'?t know|unsure|confus/i },
  { category: 'low energy', matches: /low energy|unmotivated|lazy|can'?t focus/i },
  { category: 'overwhelm',  matches: /overwhelm|too much|stuck/i },
  { category: 'waiting',    matches: /waiting|blocked|depends on/i },
];

export function categorize(reason: string): string {
  for (const k of KEYWORDS) if (k.matches.test(reason)) return k.category;
  return 'other';
}

export async function logExcuse(taskId: string, reason: string): Promise<Excuse> {
  const e: Excuse = {
    id: generateId(),
    taskId,
    reason: reason.trim(),
    category: categorize(reason),
    createdAt: Date.now(),
  };
  await insertExcuse(e);
  return e;
}

export { getAllExcuses, getExcusePatterns };

