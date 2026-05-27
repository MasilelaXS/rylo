import type { MoodLog } from '../types';
import { getDatabase } from './database';

function rowToLog(row: any): MoodLog {
  return {
    id:        row.id as string,
    logDate:   row.log_date as string,
    energy:    row.energy as number,
    mood:      row.mood as number,
    note:      (row.note as string) ?? '',
    createdAt: row.created_at as number,
  };
}

export async function getAllMoodLogs(): Promise<MoodLog[]> {
  const db   = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM mood_logs ORDER BY log_date DESC');
  return rows.map(rowToLog);
}

export async function getMoodLogsSince(since: string): Promise<MoodLog[]> {
  const db   = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM mood_logs WHERE log_date >= ? ORDER BY log_date ASC',
    [since],
  );
  return rows.map(rowToLog);
}

export async function getLogForDate(date: string): Promise<MoodLog | null> {
  const db  = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM mood_logs WHERE log_date = ? LIMIT 1',
    [date],
  );
  return row ? rowToLog(row) : null;
}

export async function upsertMoodLog(log: MoodLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO mood_logs (id, log_date, energy, mood, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       energy = excluded.energy,
       mood   = excluded.mood,
       note   = excluded.note`,
    [log.id, log.logDate, log.energy, log.mood, log.note, log.createdAt],
  );
}

export async function deleteMoodLog(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM mood_logs WHERE id = ?', [id]);
}
