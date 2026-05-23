// Shared-content intake — handles deep links / share-intent payloads and
// shortcut quick-add actions. Converts inbound text into a draft task.

import * as Linking from 'expo-linking';
import * as QuickActions from 'expo-quick-actions';
import { insertTask } from '../database/tasks';
import type { Task } from '../types';
import { generateId } from '../utils/constants';

export async function setupQuickActions(): Promise<void> {
  try {
    await QuickActions.setItems([
      { id: 'quick-add',      title: 'Quick add task',  subtitle: 'Capture in seconds', icon: 'symbol:plus',           params: { route: '/(tabs)' } },
      { id: 'voice-capture',  title: 'Voice capture',   subtitle: 'Speak your task',    icon: 'symbol:mic.fill',       params: { route: '/(tabs)/assistant' } },
      { id: 'next-action',    title: 'Next action',     subtitle: 'Jump to what\'s next', icon: 'symbol:bolt.fill',    params: { route: '/(tabs)/tasks' } },
    ]);
  } catch { /* unsupported on web / older OS — ignore */ }
}

export function createTaskFromText(text: string): Task {
  const title = text.split('\n')[0]?.slice(0, 120) || 'Captured';
  const description = text.length > title.length ? text : '';
  const due = new Date();
  due.setHours(due.getHours() + 1, 0, 0, 0);
  return {
    id: generateId(),
    title: title.trim(),
    description,
    dueDate: due.getTime(),
    priority: 'medium',
    status: 'pending',
    escalationLevel: 0,
    projectId: null,
    repeatType: 'none',
    voiceReminderEnabled: true,
    communicationTarget: null,
    snoozeCount: 0,
    createdAt: Date.now(),
    category: 'general',
  };
}

export async function ingestSharedText(text: string): Promise<Task | null> {
  const clean = text.trim();
  if (!clean) return null;
  const task = createTaskFromText(clean);
  await insertTask(task);
  return task;
}

/** Parses incoming deep links like pieter://capture?text=... */
export function parseCaptureUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.path === 'capture' || parsed.hostname === 'capture') {
      const text = parsed.queryParams?.text;
      if (typeof text === 'string') return text;
    }
  } catch { /* ignore */ }
  return null;
}
