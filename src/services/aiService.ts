// ─── Groq AI Service ─────────────────────────────────────────────────────────
// Free tier: https://console.groq.com — sign up, create an API key, and set
// EXPO_PUBLIC_GROQ_API_KEY in your .env file.
//
// Model: llama-3.1-8b-instant — fast, free, high-quality.

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL     = 'llama-3.1-8b-instant';
const GROQ_KEY  = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

// ─── Human-readable error codes ──────────────────────────────────────────────
export type AiErrorCode = 'GROQ_KEY_MISSING' | 'NETWORK_ERROR' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'SERVER_ERROR';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message?: string) {
    super(message ?? code);
  }
}

export function friendlyAiError(e: unknown): string {
  if (e instanceof AiError) {
    switch (e.code) {
      case 'GROQ_KEY_MISSING': return 'Add your free Groq API key as EXPO_PUBLIC_GROQ_API_KEY in your .env file.\n\nGet one at console.groq.com';
      case 'NETWORK_ERROR':    return 'No internet connection. Please check your network and try again.';
      case 'RATE_LIMIT':       return 'AI rate limit reached. Please wait a moment and try again.';
      case 'AUTH_ERROR':       return 'Invalid Groq API key. Check EXPO_PUBLIC_GROQ_API_KEY in your .env file.';
      case 'SERVER_ERROR':     return 'The AI service is temporarily unavailable. Please try again shortly.';
    }
  }
  return 'Something went wrong. Please try again.';
}

async function callGroq(systemPrompt: string, userText: string): Promise<string> {
  if (!GROQ_KEY) throw new AiError('GROQ_KEY_MISSING');

  let res: Response;
  try {
    res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userText },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });
  } catch {
    throw new AiError('NETWORK_ERROR');
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 429) throw new AiError('RATE_LIMIT');
    if (res.status === 401 || res.status === 403) throw new AiError('AUTH_ERROR');
    throw new AiError('SERVER_ERROR', `Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content?.trim() ?? '';
}

export async function improveNote(content: string): Promise<string> {
  return callGroq(
    'You are a writing assistant. Improve the clarity, grammar, and flow of the user\'s note while preserving its meaning and personal voice. Return only the improved text — no preamble.',
    content
  );
}

export async function summarizeNote(content: string): Promise<string> {
  return callGroq(
    'You are a writing assistant. Summarize the key points of the user\'s note concisely in a few bullet points or short paragraph. Return only the summary — no preamble.',
    content
  );
}

export async function expandNote(content: string): Promise<string> {
  return callGroq(
    'You are a writing assistant. Expand the user\'s note with more detail, context, and depth while keeping the same tone and voice. Return only the expanded text — no preamble.',
    content
  );
}

export async function rewriteNote(content: string): Promise<string> {
  return callGroq(
    'You are a professional writing assistant. Rewrite the user\'s text to sound polished, confident, and professional — suitable for a business or formal context. Fix grammar, sharpen word choice, and improve structure. Preserve the original meaning. Return only the rewritten text — no preamble, no explanation.',
    content
  );
}

// ─── Note → Tasks extraction ──────────────────────────────────────────────────
export interface ExtractedTask {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDays: number;
}

export async function extractTasksFromNote(content: string): Promise<ExtractedTask[]> {
  const raw = await callGroq(
    `You are a task extraction assistant. Read the note and identify distinct actionable items. For each, output a JSON object on its own line with keys: title (string), priority ("low"|"medium"|"high"|"urgent"), dueDays (integer: 0=today, 1=tomorrow, 7=next week, 30=next month — infer from context, default 1). Output ONLY the JSON lines — no explanation, no markdown, no preamble.`,
    content
  );
  const tasks: ExtractedTask[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      tasks.push(JSON.parse(trimmed) as ExtractedTask);
    } catch { /* skip malformed */ }
  }
  return tasks;
}

// ─── Smart scheduling suggestion ─────────────────────────────────────────────
export async function suggestSchedule(
  taskTitle: string,
  todayTaskCount: number,
  estimatedMinutes: number,
  existingTasks: { title: string; dueDate: string; estimatedMinutes: number }[]
): Promise<string> {
  const context = existingTasks.length
    ? `Existing tasks today:\n${existingTasks.map(t => `- "${t.title}" at ${t.dueDate} (~${t.estimatedMinutes}m)`).join('\n')}`
    : 'No other tasks scheduled today.';
  return callGroq(
    `You are a smart scheduling assistant. Given a task and the user's current workload, suggest the best time to schedule it and briefly explain why. Be concise (1–2 sentences). Output only the suggestion — no preamble.`,
    `Task: "${taskTitle}" (estimated ${estimatedMinutes || 30} minutes)\nTotal tasks today: ${todayTaskCount}\n${context}`
  );
}

// ─── Due date hint from task title ───────────────────────────────────────────
// Returns { dueDays } where dueDays is 0=today, 1=tomorrow, N=N days from now.
// Returns null if no date cue detected.
export async function parseDueDateHint(title: string): Promise<number | null> {
  const raw = await callGroq(
    `You detect date references in task titles. If the title contains a clear date cue (e.g. "tomorrow", "next Monday", "by Friday", "in 3 days", "end of week"), return ONLY a JSON object like {"dueDays":N} where N is the number of days from today. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}. If there is no clear date cue, return exactly: null`,
    title
  );
  const trimmed = raw.trim();
  if (trimmed === 'null') return null;
  try {
    const parsed = JSON.parse(trimmed) as { dueDays?: number };
    if (typeof parsed.dueDays === 'number') return parsed.dueDays;
  } catch { /* no date cue */ }
  return null;
}

// ─── Chat assistant ───────────────────────────────────────────────────────────
export async function chatWithAssistant(
  messages: { role: 'user' | 'assistant'; content: string }[],
  taskContext: string
): Promise<string> {
  if (!GROQ_KEY) throw new AiError('GROQ_KEY_MISSING');

  const systemPrompt = `You are Rylo, a sharp personal productivity assistant built into a task management app. You know the user's current workload and help them stay organised and focused.

${taskContext}

RESPONSE GUIDELINES:
- Be direct, concise, and motivating
- Keep replies to 2–4 sentences unless detail is genuinely needed
- When asked to help write or improve tasks/notes, be specific
- Do not repeat the user's question back to them

TASK & PROJECT CREATION:
When the user asks you to create a task or project (or you identify something specific that should become one), embed structured markers directly in your reply. The app will extract them and show interactive creation cards — do NOT mention the markers in your readable text.

To create a task, include:
<<CREATE_TASK>>{"title":"Task title","description":"Short description","priority":"medium","dueDays":1}<<END_TASK>>

To create a project, include:
<<CREATE_PROJECT>>{"name":"Project name","description":"Short description","color":"#1E90FF"}<<END_PROJECT>>

Rules:
- priority must be one of: low | medium | high | urgent
- dueDays is an integer: 0=today, 1=tomorrow, 7=next week, 30=next month
- You may include multiple markers in one response for multiple items
- Only include markers when the user explicitly asks to create, or you are confidently suggesting a specific named item to create`;

  let res: Response;
  try {
    res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 768,
        temperature: 0.8,
      }),
    });
  } catch {
    throw new AiError('NETWORK_ERROR');
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 429) throw new AiError('RATE_LIMIT');
    if (res.status === 401 || res.status === 403) throw new AiError('AUTH_ERROR');
    throw new AiError('SERVER_ERROR', `Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content?.trim() ?? '';
}
