// Project breakdown service — turns a goal into structured subtasks via Groq AI.

import { insertTask } from '../database/tasks';
import type { Priority, Task } from '../types';
import { generateId } from '../utils/constants';
import { AiError, friendlyAiError } from './aiService';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL     = 'llama-3.1-8b-instant';
const GROQ_KEY  = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

export interface BreakdownStep {
  title: string;
  description: string;
  priority: Priority;
  dueDays: number;
  estimatedMinutes: number;
}

export async function breakdownGoal(goal: string): Promise<BreakdownStep[]> {
  if (!GROQ_KEY) throw new AiError('GROQ_KEY_MISSING');
  let res: Response;
  try {
    res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a project planning assistant. Break down the user's goal into 4-10 concrete, sequential tasks. For each, output ONE JSON object per line with keys: title (string), description (string, <= 18 words), priority ("low"|"medium"|"high"|"urgent"), dueDays (integer 0+), estimatedMinutes (integer). Tasks should be ordered earliest-first. Output ONLY the JSON lines — no explanation, no markdown.`,
          },
          { role: 'user', content: goal },
        ],
        max_tokens: 900,
        temperature: 0.6,
      }),
    });
  } catch {
    throw new AiError('NETWORK_ERROR');
  }
  if (!res.ok) {
    if (res.status === 429) throw new AiError('RATE_LIMIT');
    if (res.status === 401 || res.status === 403) throw new AiError('AUTH_ERROR');
    throw new AiError('SERVER_ERROR');
  }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  const raw = data.choices[0]?.message?.content ?? '';
  const steps: BreakdownStep[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim().replace(/^[-*]?\s*/, '');
    if (!trimmed.startsWith('{')) continue;
    try {
      const o = JSON.parse(trimmed) as Partial<BreakdownStep>;
      if (!o.title) continue;
      steps.push({
        title: String(o.title),
        description: String(o.description ?? ''),
        priority: (o.priority as Priority) ?? 'medium',
        dueDays: Number(o.dueDays ?? 1),
        estimatedMinutes: Number(o.estimatedMinutes ?? 30),
      });
    } catch { /* skip */ }
  }
  return steps;
}

export async function commitBreakdown(projectId: string, steps: BreakdownStep[]): Promise<Task[]> {
  const created: Task[] = [];
  for (const s of steps) {
    const due = new Date();
    due.setDate(due.getDate() + s.dueDays);
    due.setHours(9, 0, 0, 0);
    const t: Task = {
      id: generateId(),
      title: s.title,
      description: s.description,
      dueDate: due.getTime(),
      priority: s.priority,
      status: 'pending',
      escalationLevel: 0,
      projectId,
      repeatType: 'none',
      voiceReminderEnabled: true,
      communicationTarget: null,
      snoozeCount: 0,
      createdAt: Date.now(),
      estimatedMinutes: s.estimatedMinutes,
      category: 'general',
    };
    await insertTask(t);
    created.push(t);
  }
  return created;
}

export { friendlyAiError };

