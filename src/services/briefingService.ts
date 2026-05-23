// Briefing service — speaks the morning / evening plan and slip review using TTS.

import type { Task } from '../types';
import { speakText, stopSpeaking } from '../voice/ttsService';

function timeStr(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function buildMorningBriefing(tasks: Task[], userName: string): string {
  const now = Date.now();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const today = tasks.filter((t) => t.dueDate >= start.getTime() && t.dueDate <= end.getTime() && t.status !== 'completed' && t.status !== 'cancelled');
  const overdue = tasks.filter((t) => t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled');
  const greet = userName ? `Good morning, ${userName}.` : 'Good morning.';

  if (today.length === 0 && overdue.length === 0) {
    return `${greet} You have a clear plate today. Use it well.`;
  }
  const parts: string[] = [greet];
  if (overdue.length > 0) parts.push(`${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue from before today.`);
  parts.push(`You have ${today.length} task${today.length > 1 ? 's' : ''} scheduled.`);
  const first = today.sort((a, b) => a.dueDate - b.dueDate)[0];
  if (first) parts.push(`First up: ${first.title} at ${timeStr(first.dueDate)}.`);
  parts.push('Let\'s execute.');
  return parts.join(' ');
}

export function buildEveningBriefing(tasks: Task[], userName: string): string {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);

  const today = tasks.filter((t) => t.dueDate >= start.getTime() && t.dueDate <= end.getTime());
  const done = today.filter((t) => t.status === 'completed').length;
  const slipped = today.filter((t) => t.status !== 'completed' && t.status !== 'cancelled').length;
  const greet = userName ? `Evening review, ${userName}.` : 'Evening review.';

  if (today.length === 0) return `${greet} Nothing was scheduled for today.`;
  const parts = [`${greet} You completed ${done} of ${today.length} task${today.length > 1 ? 's' : ''}.`];
  if (slipped > 0) parts.push(`${slipped} slipped into tomorrow.`);
  if (done === today.length) parts.push('Clean sweep. Well done.');
  else if (done >= today.length / 2) parts.push('Solid effort. Tighten it up tomorrow.');
  else parts.push('Tomorrow needs more execution. What got in the way today?');
  return parts.join(' ');
}

export function speakBriefing(text: string): void {
  stopSpeaking();
  speakText(text);
}
