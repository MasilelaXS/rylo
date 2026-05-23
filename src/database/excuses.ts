import type { Excuse } from '../types';
import { getDatabase } from './database';

function rowToExcuse(row: Record<string, unknown>): Excuse {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    reason: (row.reason as string) ?? '',
    category: (row.category as string) ?? '',
    createdAt: row.created_at as number,
  };
}

export async function insertExcuse(e: Excuse): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO excuses (id, task_id, reason, category, created_at) VALUES (?, ?, ?, ?, ?)',
    [e.id, e.taskId, e.reason, e.category, e.createdAt]
  );
}

export async function getExcusesForTask(taskId: string): Promise<Excuse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM excuses WHERE task_id = ? ORDER BY created_at DESC',
    [taskId]
  );
  return rows.map(rowToExcuse);
}

export async function getAllExcuses(): Promise<Excuse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM excuses ORDER BY created_at DESC'
  );
  return rows.map(rowToExcuse);
}

export async function getExcusePatterns(): Promise<{ category: string; count: number }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT category, COUNT(*) as count FROM excuses
     WHERE category <> '' GROUP BY category ORDER BY count DESC LIMIT 8`
  );
  return rows.map((r) => ({ category: r.category as string, count: r.count as number }));
}
