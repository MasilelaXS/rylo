import * as Speech from 'expo-speech';
import { triggerNotificationGlow } from '../components/NotificationGlow';
import type { ReminderMode } from '../types';
import { REMINDER_PHRASES } from '../utils/constants';

/** Read the user's chosen voice identifier from the settings store (outside React). */
function getVoiceOptions(rate?: number): Speech.SpeechOptions {
  try {
    // Dynamic require avoids a circular-dep since settingsStore doesn't import ttsService
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSettingsStore } = require('../store/settingsStore') as typeof import('../store/settingsStore');
    const { settings } = useSettingsStore.getState();
    return {
      language: 'en-US',
      rate: rate ?? settings.speechRate,
      ...(settings.selectedVoiceId ? { voice: settings.selectedVoiceId } : {}),
    };
  } catch {
    return { language: 'en-US', rate: rate ?? 1.0 };
  }
}

export function speakReminder(taskTitle: string, mode: ReminderMode, rate?: number): void {
  const phrases = REMINDER_PHRASES[mode] ?? REMINDER_PHRASES.strict;
  const template = phrases[Math.floor(Math.random() * phrases.length)];
  const text = template.replace('{task}', taskTitle);

  const opts = getVoiceOptions(rate);
  triggerNotificationGlow();
  Speech.speak(text, {
    ...opts,
    pitch: mode === 'military' ? 0.85 : mode === 'aggressive' ? 1.1 : 1.0,
    onError: () => {}, // silent fail
  });
}

export function speakText(text: string, rate?: number): void {
  triggerNotificationGlow();
  Speech.speak(text, getVoiceOptions(rate));
}

export function stopSpeaking(): void {
  Speech.stop();
}

export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  return Speech.getAvailableVoicesAsync();
}

export function speakMorningBriefing(total: number, overdue: number): void {
  const text = overdue > 0
    ? `Good morning. You have ${total} tasks today, including ${overdue} overdue. Let's get moving.`
    : `Good morning. You have ${total} tasks scheduled for today. Let's make it count.`;
  speakText(text);
}

export function speakEveningBriefing(completed: number, total: number): void {
  const text = completed === total
    ? `Outstanding. You completed all ${total} tasks today. Zero debt. Well done.`
    : `Day complete. You finished ${completed} of ${total} tasks. ${total - completed} remain outstanding.`;
  speakText(text);
}

export function speakHourlySummary(pending: number, overdue: number, nextTask?: { title: string; dueTime: string }): void {
  if (pending === 0) {
    speakText('All clear. No outstanding tasks right now.');
    return;
  }
  const overdueNote = overdue > 0 ? ` ${overdue} overdue.` : '';
  const nextNote = nextTask ? ` Next up: ${nextTask.title} at ${nextTask.dueTime}.` : '';
  speakText(`Hourly check. ${pending} tasks outstanding.${overdueNote}${nextNote}`);
}
