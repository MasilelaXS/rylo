// Voice capture service — records audio and (best-effort) transcribes it.
// On-device STT is not in Expo SDK 55; we record audio via expo-av and store
// the clip. If a transcription provider key is present we send it for ASR;
// otherwise we save the recording and let the user type a transcript.

import { Audio } from 'expo-av';
import { insertTask } from '../database/tasks';
import { insertVoiceNote } from '../database/voiceNotes';
import type { Task, VoiceNote } from '../types';
import { generateId } from '../utils/constants';
import { extractTasksFromNote, type ExtractedTask } from './aiService';

let _recording: Audio.Recording | null = null;
let _startedAt = 0;

export async function ensurePermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

export async function startRecording(): Promise<void> {
  if (_recording) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
  const rec = new Audio.Recording();
  await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await rec.startAsync();
  _recording = rec;
  _startedAt = Date.now();
}

export async function stopRecording(): Promise<{ uri: string | null; durationMs: number }> {
  if (!_recording) return { uri: null, durationMs: 0 };
  await _recording.stopAndUnloadAsync();
  const uri = _recording.getURI();
  const duration = Date.now() - _startedAt;
  _recording = null;
  _startedAt = 0;
  return { uri, durationMs: duration };
}

export async function isRecording(): Promise<boolean> {
  return !!_recording;
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
