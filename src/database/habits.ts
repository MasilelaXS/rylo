import type { Habit, HabitCompletion } from '../types';
import { generateId } from '../utils/constants';
import { getDatabase } from './database';

// ─── Row mappers ─────────────────────────────────────────────────────────────
function rowToHabit(r: Record<string, unknown>): Habit {
  return {
    id: r.id as string,
    name: r.name as string,
    icon: (r.icon as string) || 'checkmark-circle-outline',
    color: (r.color as string) || '#1E90FF',
    frequency: ((r.frequency as string) || 'daily') as Habit['frequency'],
    targetDays:
      r.target_days && (r.target_days as string).length > 0
        ? (r.target_days as string).split(',').map(Number)
        : [],
    createdAt: r.created_at as number,
    archived: !!(r.archived as number),
  };
}

function rowToCompletion(r: Record<string, unknown>): HabitCompletion {
  return {
    id: r.id as string,
    habitId: r.habit_id as string,
    completedDate: r.completed_date as string,
    createdAt: r.created_at as number,
  };
}

// ─── Habits CRUD ─────────────────────────────────────────────────────────────
export async function getAllHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC',
  );
  return rows.map(rowToHabit);
}

export async function insertHabit(habit: Habit): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO habits (id, name, icon, color, frequency, target_days, created_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      habit.id,
      habit.name,
      habit.icon,
      habit.color,
      habit.frequency,
      habit.targetDays.join(','),
      habit.createdAt,
      habit.archived ? 1 : 0,
    ],
  );
}

export async function updateHabit(
  habit: Partial<Habit> & { id: string },
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (habit.name !== undefined)       { sets.push('name = ?');        vals.push(habit.name); }
  if (habit.icon !== undefined)       { sets.push('icon = ?');        vals.push(habit.icon); }
  if (habit.color !== undefined)      { sets.push('color = ?');       vals.push(habit.color); }
  if (habit.frequency !== undefined)  { sets.push('frequency = ?');   vals.push(habit.frequency); }
  if (habit.targetDays !== undefined) { sets.push('target_days = ?'); vals.push(habit.targetDays.join(',')); }
  if (habit.archived !== undefined)   { sets.push('archived = ?');    vals.push(habit.archived ? 1 : 0); }
  if (sets.length === 0) return;
  vals.push(habit.id);
  await db.runAsync(`UPDATE habits SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteHabit(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM habit_completions WHERE habit_id = ?', [id]);
}

// ─── Completions ─────────────────────────────────────────────────────────────
export async function getAllCompletionsSince(
  since: string,
): Promise<HabitCompletion[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM habit_completions WHERE completed_date >= ? ORDER BY completed_date DESC',
    [since],
  );
  return rows.map(rowToCompletion);
}

/**
 * Toggles a completion for the given habit on the given date.
 * Returns `true` if the day is now marked done, `false` if unchecked.
 */
export async function toggleCompletion(
  habitId: string,
  date: string,
): Promise<boolean> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string } | null>(
    'SELECT id FROM habit_completions WHERE habit_id = ? AND completed_date = ?',
    [habitId, date],
  );
  if (existing) {
    await db.runAsync(
      'DELETE FROM habit_completions WHERE habit_id = ? AND completed_date = ?',
      [habitId, date],
    );
    return false;
  }
  await db.runAsync(
    'INSERT INTO habit_completions (id, habit_id, completed_date, created_at) VALUES (?, ?, ?, ?)',
    [generateId(), habitId, date, Date.now()],
  );
  return true;
}
