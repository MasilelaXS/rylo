import type { Subtask } from '../types';
import { getDatabase } from './database';

function rowToSubtask(row: Record<string, unknown>): Subtask {
  return {
    id:        row.id as string,
    taskId:    row.task_id as string,
    title:     row.title as string,
    completed: Boolean(row.completed),
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as number,
  };
}

export async function getSubtasksForTask(taskId: string): Promise<Subtask[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC',
    [taskId]
  );
  return rows.map(rowToSubtask);
}

export async function insertSubtask(subtask: Subtask): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO subtasks (id, task_id, title, completed, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [subtask.id, subtask.taskId, subtask.title, subtask.completed ? 1 : 0, subtask.sortOrder, subtask.createdAt]
  );
}

export async function toggleSubtask(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE subtasks SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?',
    [id]
  );
}

export async function updateSubtaskTitle(id: string, title: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE subtasks SET title = ? WHERE id = ?', [title]);
}

export async function deleteSubtask(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subtasks WHERE id = ?', [id]);
}

export async function deleteSubtasksForTask(taskId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subtasks WHERE task_id = ?', [taskId]);
}
