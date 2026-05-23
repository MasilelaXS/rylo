import * as SQLite from 'expo-sqlite';
import { DB_NAME } from '../utils/constants';

// openDatabaseSync guarantees the native handle exists before any code uses it,
// eliminating the NullPointerException / race condition on Android / Hermes.
const _db = SQLite.openDatabaseSync(DB_NAME);

// Schema initialised once, synchronously, before any store can run a query.
_db.execSync(`CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#1E90FF',
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date INTEGER NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  escalation_level INTEGER DEFAULT 0,
  project_id TEXT,
  repeat_type TEXT DEFAULT 'none',
  voice_reminder_enabled INTEGER DEFAULT 1,
  communication_target TEXT,
  snooze_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  location TEXT DEFAULT ''
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  reminder_time INTEGER NOT NULL,
  escalation_level INTEGER DEFAULT 1,
  completed INTEGER DEFAULT 0
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS communication_logs (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  person_name TEXT DEFAULT '',
  communication_type TEXT DEFAULT 'message',
  outcome TEXT DEFAULT '',
  draft_message TEXT DEFAULT '',
  urgency TEXT DEFAULT 'medium',
  timestamp INTEGER NOT NULL
)`);

// Column migration — safe to ignore if already exists
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN location TEXT DEFAULT ''`); } catch (_) {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 0`); } catch (_) {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN completed_at INTEGER`); } catch (_) {}

_db.execSync(`CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
)`);

// ─── Migration version tracking ────────────────────────────────────────────
_db.execSync(`CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
)`);

// Record current schema version
const currentVersion = 2;
const versionRow = _db.getFirstSync<{ version: number } | null>(
  'SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1'
);
if (!versionRow || versionRow.version < currentVersion) {
  _db.execSync(`INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (${currentVersion}, ${Date.now()})`);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return _db;
}
