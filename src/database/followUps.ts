import type { FollowUp } from '../types';
import { getDatabase } from './database';

function row(r: Record<string, unknown>): FollowUp {
  return {
    id: r.id as string,
    sourceTaskId: r.source_task_id as string,
    chaseTaskId: r.chase_task_id as string,
    expectedReplyAt: r.expected_reply_at as number,
    createdAt: r.created_at as number,
  };
}

export async function insertFollowUp(f: FollowUp): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO follow_ups (id, source_task_id, chase_task_id, expected_reply_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [f.id, f.sourceTaskId, f.chaseTaskId, f.expectedReplyAt, f.createdAt]
  );
}

export async function getAllFollowUps(): Promise<FollowUp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM follow_ups ORDER BY expected_reply_at ASC'
  );
  return rows.map(row);
}
