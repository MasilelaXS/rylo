import type { Task } from '../types';
import { getDatabase } from './database';

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    dueDate: row.due_date as number,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    escalationLevel: row.escalation_level as number,
    projectId: (row.project_id as string | null) ?? null,
    repeatType: row.repeat_type as Task['repeatType'],
    voiceReminderEnabled: Boolean(row.voice_reminder_enabled),
    communicationTarget: (row.communication_target as string | null) ?? null,
    snoozeCount: row.snooze_count as number,
    createdAt: row.created_at as number,
    completedAt: (row.completed_at as number | null) ?? undefined,
    location: (row.location as string) ?? '',
    estimatedMinutes: (row.estimated_minutes as number) || 0,
  };
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tasks ORDER BY due_date ASC'
  );
  return rows.map(rowToTask);
}

export async function getTasksByStatus(status: Task['status']): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tasks WHERE status = ? ORDER BY due_date ASC',
    [status]
  );
  return rows.map(rowToTask);
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tasks WHERE project_id = ? ORDER BY due_date ASC',
    [projectId]
  );
  return rows.map(rowToTask);
}

export async function getTodaysTasks(): Promise<Task[]> {
  const db = await getDatabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tasks WHERE due_date >= ? AND due_date <= ? AND status NOT IN ('completed','cancelled') ORDER BY due_date ASC`,
    [startOfDay.getTime(), endOfDay.getTime()]
  );
  return rows.map(rowToTask);
}

export async function getOverdueTasks(): Promise<Task[]> {
  const db = await getDatabase();
  const now = Date.now();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tasks WHERE due_date < ? AND status NOT IN ('completed','cancelled') ORDER BY due_date ASC`,
    [now]
  );
  return rows.map(rowToTask);
}

export async function insertTask(task: Task): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO tasks (id, title, description, due_date, priority, status, escalation_level, project_id, repeat_type, voice_reminder_enabled, communication_target, snooze_count, created_at, location, estimated_minutes, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.title,
      task.description,
      task.dueDate,
      task.priority,
      task.status,
      task.escalationLevel,
      task.projectId,
      task.repeatType,
      task.voiceReminderEnabled ? 1 : 0,
      task.communicationTarget,
      task.snoozeCount,
      task.createdAt,
      task.location ?? '',
      task.estimatedMinutes ?? 0,
      task.completedAt ?? null,
    ]
  );
}

export async function updateTask(task: Partial<Task> & { id: string }): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (task.title !== undefined) { sets.push('title = ?'); values.push(task.title); }
  if (task.description !== undefined) { sets.push('description = ?'); values.push(task.description); }
  if (task.dueDate !== undefined) { sets.push('due_date = ?'); values.push(task.dueDate); }
  if (task.priority !== undefined) { sets.push('priority = ?'); values.push(task.priority); }
  if (task.status !== undefined) { sets.push('status = ?'); values.push(task.status); }
  if (task.escalationLevel !== undefined) { sets.push('escalation_level = ?'); values.push(task.escalationLevel); }
  if (task.projectId !== undefined) { sets.push('project_id = ?'); values.push(task.projectId); }
  if (task.snoozeCount !== undefined) { sets.push('snooze_count = ?'); values.push(task.snoozeCount); }
  if (task.voiceReminderEnabled !== undefined) { sets.push('voice_reminder_enabled = ?'); values.push(task.voiceReminderEnabled ? 1 : 0); }
  if (task.location !== undefined) { sets.push('location = ?'); values.push(task.location); }
  if (task.estimatedMinutes !== undefined) { sets.push('estimated_minutes = ?'); values.push(task.estimatedMinutes); }
  if (task.completedAt !== undefined) { sets.push('completed_at = ?'); values.push(task.completedAt ?? null); }

  if (sets.length === 0) return;
  values.push(task.id);
  await db.runAsync(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, values as import('expo-sqlite').SQLiteBindParams);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}

export async function completeTask(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?`, [Date.now(), id]);
}
