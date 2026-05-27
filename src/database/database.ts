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
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN location TEXT DEFAULT ''`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 0`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN completed_at INTEGER`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN committed INTEGER DEFAULT 0`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'general'`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN comm_status TEXT`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN difficulty INTEGER DEFAULT 0`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN depends_on TEXT`); } catch {}
try { _db.execSync(`ALTER TABLE tasks ADD COLUMN time_logged_minutes INTEGER DEFAULT 0`); } catch {}

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

// ─── Execution-Enforcement tables ──────────────────────────────────────────
_db.execSync(`CREATE TABLE IF NOT EXISTS excuses (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  reason TEXT DEFAULT '',
  category TEXT DEFAULT '',
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  contact TEXT DEFAULT '',
  accountability_message TEXT DEFAULT '',
  triggered INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY NOT NULL,
  source_task_id TEXT NOT NULL,
  chase_task_id TEXT NOT NULL,
  expected_reply_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS comm_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  channel TEXT DEFAULT 'sms',
  recipient TEXT DEFAULT '',
  body TEXT DEFAULT '',
  sent_at INTEGER,
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS voice_notes (
  id TEXT PRIMARY KEY NOT NULL,
  transcript TEXT DEFAULT '',
  audio_uri TEXT DEFAULT '',
  duration_ms INTEGER DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS category_streaks (
  category TEXT PRIMARY KEY NOT NULL,
  current INTEGER DEFAULT 0,
  longest INTEGER DEFAULT 0,
  last_completion_date TEXT DEFAULT ''
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'checkmark-circle-outline',
  color TEXT DEFAULT '#1E90FF',
  frequency TEXT DEFAULT 'daily',
  target_days TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  archived INTEGER DEFAULT 0
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL,
  completed_date TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`);

_db.execSync(`CREATE TABLE IF NOT EXISTS mood_logs (
  id TEXT PRIMARY KEY NOT NULL,
  log_date TEXT NOT NULL,
  energy INTEGER NOT NULL,
  mood INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at INTEGER NOT NULL
)`);

// ─── Migration version tracking ────────────────────────────────────────────
_db.execSync(`CREATE TABLE IF NOT EXISTS schema_versions (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
)`);

// Record current schema version
const currentVersion = 5;
const versionRow = _db.getFirstSync<{ version: number } | null>(
  'SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1'
);
if (!versionRow || versionRow.version < currentVersion) {
  _db.execSync(`INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (${currentVersion}, ${Date.now()})`);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return _db;
}
