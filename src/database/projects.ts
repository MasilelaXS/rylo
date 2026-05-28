import type { Project } from '../types';
import { getDatabase } from './database';

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    color: (row.color as string) ?? '#1E90FF',
    createdAt: row.created_at as number,
    pageContent: (row.page_content as string) ?? '',
  };
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM projects ORDER BY created_at DESC'
  );
  return rows.map(rowToProject);
}

export async function insertProject(project: Project): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO projects (id, name, description, color, page_content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [project.id, project.name, project.description, project.color, project.pageContent ?? '', project.createdAt]
  );
}

export async function updateProject(project: Partial<Project> & { id: string }): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (project.name !== undefined)        { sets.push('name = ?');         values.push(project.name); }
  if (project.description !== undefined) { sets.push('description = ?');  values.push(project.description); }
  if (project.color !== undefined)       { sets.push('color = ?');        values.push(project.color); }
  if (project.pageContent !== undefined) { sets.push('page_content = ?'); values.push(project.pageContent); }

  if (sets.length === 0) return;
  values.push(project.id);
  await db.runAsync(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, values as import('expo-sqlite').SQLiteBindParams);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
}
