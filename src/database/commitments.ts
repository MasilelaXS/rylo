import type { Commitment } from '../types';
import { getDatabase } from './database';

function row(r: Record<string, unknown>): Commitment {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    contact: (r.contact as string) ?? '',
    accountabilityMessage: (r.accountability_message as string) ?? '',
    triggered: Boolean(r.triggered),
    createdAt: r.created_at as number,
  };
}

export async function insertCommitment(c: Commitment): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO commitments (id, task_id, contact, accountability_message, triggered, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [c.id, c.taskId, c.contact, c.accountabilityMessage, c.triggered ? 1 : 0, c.createdAt]
  );
}

export async function getCommitmentForTask(taskId: string): Promise<Commitment | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM commitments WHERE task_id = ? LIMIT 1',
    [taskId]
  );
  return r ? row(r) : null;
}

export async function markCommitmentTriggered(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE commitments SET triggered = 1 WHERE id = ?', [id]);
}

export async function deleteCommitmentForTask(taskId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM commitments WHERE task_id = ?', [taskId]);
}
