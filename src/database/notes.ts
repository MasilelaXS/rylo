import type { Note } from '../types';
import { getDatabase } from './database';

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id:        row.id as string,
    title:     (row.title as string) ?? '',
    content:   (row.content as string) ?? '',
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM notes ORDER BY updated_at DESC'
  );
  return rows.map(rowToNote);
}

export async function insertNote(note: Note): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [note.id, note.title, note.content, note.createdAt, note.updatedAt]
  );
}

export async function updateNote(note: Partial<Note> & { id: string }): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE notes SET title = COALESCE(?, title), content = COALESCE(?, content), updated_at = ? WHERE id = ?`,
    [note.title ?? null, note.content ?? null, Date.now(), note.id]
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}
