import type { Note } from '../types';
import { getDatabase } from './database';

function rowToNote(row: Record<string, unknown>): Note {
  let tags: string[] = [];
  try { tags = JSON.parse((row.tags as string) ?? '[]'); } catch {}
  return {
    id:        row.id as string,
    title:     (row.title as string) ?? '',
    content:   (row.content as string) ?? '',
    tags,
    folder:    (row.folder as string) ?? '',
    pinned:    Boolean(row.pinned),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC'
  );
  return rows.map(rowToNote);
}

export async function insertNote(note: Note): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO notes (id, title, content, tags, folder, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [note.id, note.title, note.content, JSON.stringify(note.tags ?? []), note.folder ?? '', note.pinned ? 1 : 0, note.createdAt, note.updatedAt]
  );
}

export async function updateNote(note: Partial<Note> & { id: string }): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (note.title !== undefined)   { sets.push('title = ?');   values.push(note.title); }
  if (note.content !== undefined) { sets.push('content = ?'); values.push(note.content); }
  if (note.tags !== undefined)    { sets.push('tags = ?');    values.push(JSON.stringify(note.tags)); }
  if (note.folder !== undefined)  { sets.push('folder = ?');  values.push(note.folder); }
  if (note.pinned !== undefined)  { sets.push('pinned = ?');  values.push(note.pinned ? 1 : 0); }
  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(note.id);
  if (sets.length === 1) return; // only updated_at — still run to bump timestamp
  await db.runAsync(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, values as import('expo-sqlite').SQLiteBindParams);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}
