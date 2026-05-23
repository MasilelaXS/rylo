import type { CommDraft } from '../types';
import { getDatabase } from './database';

function row(r: Record<string, unknown>): CommDraft {
  return {
    id: r.id as string,
    taskId: r.task_id as string,
    channel: (r.channel as CommDraft['channel']) ?? 'sms',
    recipient: (r.recipient as string) ?? '',
    body: (r.body as string) ?? '',
    sentAt: (r.sent_at as number | null) ?? undefined,
    createdAt: r.created_at as number,
  };
}

export async function insertDraft(d: CommDraft): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO comm_drafts (id, task_id, channel, recipient, body, sent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [d.id, d.taskId, d.channel, d.recipient, d.body, d.sentAt ?? null, d.createdAt]
  );
}

export async function markDraftSent(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE comm_drafts SET sent_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function getDraftsForTask(taskId: string): Promise<CommDraft[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM comm_drafts WHERE task_id = ? ORDER BY created_at DESC',
    [taskId]
  );
  return rows.map(row);
}
