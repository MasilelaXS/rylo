// Voice capture service — transcribes audio via Groq Whisper and saves the
// resulting note + extracted tasks. Recording itself is handled by the
// component using the `expo-audio` hook API (see VoiceCaptureModal).

import { insertTask } from '../database/tasks';
import { insertVoiceNote } from '../database/voiceNotes';
import type { Task, VoiceNote } from '../types';
import { generateId } from '../utils/constants';
import { extractTasksFromNote, type ExtractedTask } from './aiService';

const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

export function isTranscriptionAvailable(): boolean {
  return GROQ_KEY.length > 0;
}

export async function transcribeAudio(uri: string): Promise<string> {
  if (!GROQ_KEY) throw new Error('GROQ_KEY_MISSING');
  const form = new FormData();
  // React Native's FormData accepts { uri, name, type } file shape
  form.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' } as unknown as Blob);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'text');
  form.append('temperature', '0');

  const res = await fetch(GROQ_AUDIO_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq transcription failed ${res.status}: ${detail}`);
  }
  // response_format=text returns plain text body
  return (await res.text()).trim();
}

export async function saveTranscript(transcript: string, audioUri: string | null, durationMs: number): Promise<{
  note: VoiceNote;
  extracted: ExtractedTask[];
  tasks: Task[];
}> {
  let extracted: ExtractedTask[] = [];
  try {
    if (transcript.trim().length > 0) {
      extracted = await extractTasksFromNote(transcript);
    }
  } catch { /* AI unavailable — skip extraction */ }

  const tasks: Task[] = [];
  for (const ex of extracted) {
    const due = new Date();
    due.setDate(due.getDate() + (ex.dueDays ?? 1));
    due.setHours(9, 0, 0, 0);
    const t: Task = {
      id: generateId(),
      title: ex.title,
      description: '',
      dueDate: due.getTime(),
      priority: ex.priority,
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
    await insertTask(t);
    tasks.push(t);
  }

  const note: VoiceNote = {
    id: generateId(),
    transcript: transcript.trim(),
    audioUri: audioUri ?? undefined,
    durationMs,
    taskCount: tasks.length,
    createdAt: Date.now(),
  };
  await insertVoiceNote(note);
  return { note, extracted, tasks };
}
