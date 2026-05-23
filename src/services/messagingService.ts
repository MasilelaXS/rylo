// Messaging service — turns a comm task into a draft and opens the native share / sms / mailto sheet.

import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';
import { insertDraft, markDraftSent } from '../database/commDrafts';
import type { CommDraft, CommunicationType, Task } from '../types';
import { generateId } from '../utils/constants';
import { friendlyAiError } from './aiService';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL     = 'llama-3.1-8b-instant';
const GROQ_KEY  = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

export async function generateDraft(task: Task, channel: CommDraft['channel'], extraContext?: string): Promise<string> {
  const tone = channel === 'email' ? 'professional but warm' : 'concise and friendly';
  const target = task.communicationTarget?.trim() || 'them';
  const userMsg = [
    `Subject of the message: ${task.title}.`,
    task.description ? `Context: ${task.description}` : '',
    `Recipient: ${target}.`,
    `Channel: ${channel}.`,
    extraContext ? `Extra: ${extraContext}` : '',
  ].filter(Boolean).join('\n');

  if (!GROQ_KEY) {
    // Offline / no-key fallback — generate a simple template.
    return offlineTemplate(task, channel);
  }

  try {
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You draft short ${channel} messages. Tone: ${tone}. Output ONLY the message body — no greeting placeholders, no signature, no preamble. Max 80 words.`,
          },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content?.trim() || offlineTemplate(task, channel);
  } catch (e) {
    console.warn('[messagingService] draft fallback:', friendlyAiError(e));
    return offlineTemplate(task, channel);
  }
}

function offlineTemplate(task: Task, channel: CommDraft['channel']): string {
  const target = task.communicationTarget?.trim() || 'there';
  if (channel === 'email') {
    return `Hi ${target},\n\nQuick note about "${task.title}". ${task.description || ''}\n\nLet me know your thoughts.\n\nThanks`;
  }
  return `Hey ${target} — quick one about "${task.title}". ${task.description || ''}`.trim();
}

export async function saveDraft(taskId: string, channel: CommDraft['channel'], recipient: string, body: string): Promise<CommDraft> {
  const d: CommDraft = {
    id: generateId(),
    taskId,
    channel,
    recipient,
    body,
    createdAt: Date.now(),
  };
  await insertDraft(d);
  return d;
}

export async function sendDraft(draft: CommDraft): Promise<void> {
  const enc = encodeURIComponent;
  switch (draft.channel) {
    case 'sms': {
      const sep = Platform.OS === 'ios' ? '&' : '?';
      const url = `sms:${enc(draft.recipient)}${sep}body=${enc(draft.body)}`;
      await Linking.openURL(url);
      break;
    }
    case 'whatsapp': {
      const url = `whatsapp://send?phone=${enc(draft.recipient.replace(/[^0-9+]/g, ''))}&text=${enc(draft.body)}`;
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else await Share.share({ message: draft.body });
      break;
    }
    case 'email': {
      const url = `mailto:${enc(draft.recipient)}?subject=${enc('Quick note')}&body=${enc(draft.body)}`;
      await Linking.openURL(url);
      break;
    }
    default: {
      await Share.share({ message: draft.body });
    }
  }
  await markDraftSent(draft.id);
}

export async function copyDraft(body: string): Promise<void> {
  await Clipboard.setStringAsync(body);
}

export function channelFor(type: CommunicationType | undefined): CommDraft['channel'] {
  switch (type) {
    case 'call':    return 'sms';
    case 'email':   return 'email';
    case 'message': return 'sms';
    default:        return 'sms';
  }
}
