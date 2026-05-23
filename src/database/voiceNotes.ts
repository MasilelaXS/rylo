import type { VoiceNote } from '../types';
import { getDatabase } from './database';

function row(r: Record<string, unknown>): VoiceNote {
  return {
    id: r.id as string,
    transcript: (r.transcript as string) ?? '',
    audioUri: (r.audio_uri as string) || undefined,
    durationMs: (r.duration_ms as number) || 0,
    taskCount: (r.task_count as number) || 0,
    createdAt: r.created_at as number,
  };
}

export async function insertVoiceNote(v: VoiceNote): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO voice_notes (id, transcript, audio_uri, duration_ms, task_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [v.id, v.transcript, v.audioUri ?? '', v.durationMs ?? 0, v.taskCount ?? 0, v.createdAt]
  );
}

export async function getAllVoiceNotes(): Promise<VoiceNote[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM voice_notes ORDER BY created_at DESC'
  );
  return rows.map(row);
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM voice_notes WHERE id = ?', [id]);
}
