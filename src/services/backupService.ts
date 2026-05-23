// Backup service — exports/imports the full SQLite + settings state as an
// AES-encrypted JSON blob. Uses crypto-js (pure JS, Hermes-safe) so it works
// in Expo without prebuild.

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '../database/database';

const TABLES = [
  'projects', 'tasks', 'reminders', 'communication_logs',
  'notes', 'subtasks',
  'excuses', 'commitments', 'follow_ups', 'comm_drafts',
  'voice_notes', 'category_streaks',
] as const;

const MAGIC = 'PIETER_BACKUP_V1';

interface BackupPayload {
  magic: string;
  exportedAt: number;
  tables: Record<string, Record<string, unknown>[]>;
  asyncStorage: Record<string, string>;
}

async function snapshot(): Promise<BackupPayload> {
  const db = await getDatabase();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) {
    try {
      tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
    } catch {
      tables[t] = [];
    }
  }
  const keys = await AsyncStorage.getAllKeys();
  const entries = await AsyncStorage.multiGet(keys);
  const asyncStorage: Record<string, string> = {};
  for (const [k, v] of entries) if (v != null) asyncStorage[k] = v;
  return { magic: MAGIC, exportedAt: Date.now(), tables, asyncStorage };
}

function encrypt(json: string, passphrase: string): string {
  return CryptoJS.AES.encrypt(json, passphrase).toString();
}

function decrypt(blob: string, passphrase: string): string {
  const bytes = CryptoJS.AES.decrypt(blob, passphrase);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export async function exportEncryptedBackup(passphrase: string): Promise<string> {
  const data = await snapshot();
  const cipher = encrypt(JSON.stringify(data), passphrase);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
  const path = `${dir}pieter-backup-${stamp}.pieterbak`;
  await FileSystem.writeAsStringAsync(path, cipher, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/octet-stream', dialogTitle: 'Save backup' });
  }
  return path;
}

export async function importEncryptedBackup(passphrase: string): Promise<{ restored: number }> {
  const pick = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (pick.canceled || !pick.assets?.[0]) return { restored: 0 };
  const uri = pick.assets[0].uri;
  const cipher = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  const plain = decrypt(cipher, passphrase);
  if (!plain) throw new Error('Wrong passphrase or corrupted backup.');
  const payload = JSON.parse(plain) as BackupPayload;
  if (payload.magic !== MAGIC) throw new Error('Not a Pieter backup file.');

  const db = await getDatabase();
  let restored = 0;
  for (const t of TABLES) {
    const rows = payload.tables[t] ?? [];
    if (rows.length === 0) continue;
    // Clear table then re-insert all rows.
    await db.execAsync(`DELETE FROM ${t}`);
    for (const r of rows) {
      const cols = Object.keys(r);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => r[c] as never);
      await db.runAsync(
        `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`,
        values
      );
      restored++;
    }
  }
  // Restore AsyncStorage
  const pairs: [string, string][] = Object.entries(payload.asyncStorage);
  if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
  return { restored };
}
