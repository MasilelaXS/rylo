import type { CategoryStreak, StreakCategory } from '../types';
import { getDatabase } from './database';

const ALL: StreakCategory[] = ['communication', 'deep_work', 'admin', 'personal', 'general'];

function row(r: Record<string, unknown>): CategoryStreak {
  return {
    category: r.category as StreakCategory,
    current: (r.current as number) || 0,
    longest: (r.longest as number) || 0,
    lastCompletionDate: (r.last_completion_date as string) || '',
  };
}

export async function getAllStreaks(): Promise<CategoryStreak[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM category_streaks');
  const map = new Map(rows.map((r) => [r.category as string, row(r)]));
  return ALL.map((c) => map.get(c) ?? { category: c, current: 0, longest: 0, lastCompletionDate: '' });
}

export async function recordCompletion(category: StreakCategory): Promise<CategoryStreak> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const existing = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM category_streaks WHERE category = ?',
    [category]
  );

  let current = 1, longest = 1;
  if (existing) {
    const prev = row(existing);
    if (prev.lastCompletionDate === today) {
      current = prev.current;
      longest = prev.longest;
    } else if (prev.lastCompletionDate === yesterday) {
      current = prev.current + 1;
      longest = Math.max(prev.longest, current);
    } else {
      current = 1;
      longest = Math.max(prev.longest, 1);
    }
    await db.runAsync(
      'UPDATE category_streaks SET current = ?, longest = ?, last_completion_date = ? WHERE category = ?',
      [current, longest, today, category]
    );
  } else {
    await db.runAsync(
      'INSERT INTO category_streaks (category, current, longest, last_completion_date) VALUES (?, ?, ?, ?)',
      [category, current, longest, today]
    );
  }
  return { category, current, longest, lastCompletionDate: today };
}
