import type { CommunicationLog } from '../types';
import { getDatabase } from './database';

function rowToLog(row: Record<string, unknown>): CommunicationLog {
  return {
    id:                row.id as string,
    taskId:            row.task_id as string,
    personName:        (row.person_name as string) ?? '',
    communicationType: row.communication_type as CommunicationLog['communicationType'],
    outcome:           (row.outcome as string) ?? '',
    draftMessage:      (row.draft_message as string) ?? '',
    urgency:           row.urgency as CommunicationLog['urgency'],
    timestamp:         row.timestamp as number,
  };
}

export async function getAllLogs(): Promise<CommunicationLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM communication_logs ORDER BY timestamp DESC'
  );
  return rows.map(rowToLog);
}

export async function getLogsForTask(taskId: string): Promise<CommunicationLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM communication_logs WHERE task_id = ? ORDER BY timestamp DESC',
    [taskId]
  );
  return rows.map(rowToLog);
}

export async function insertLog(log: CommunicationLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO communication_logs (id, task_id, person_name, communication_type, outcome, draft_message, urgency, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [log.id, log.taskId, log.personName, log.communicationType, log.outcome, log.draftMessage, log.urgency, log.timestamp]
  );
}

export async function deleteLog(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM communication_logs WHERE id = ?', [id]);
}
