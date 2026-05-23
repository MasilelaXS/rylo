// ─── Colors & Theme (Light) ───────────────────────────────────────────────────
export const COLORS = {
  // ── Surfaces
  bg:       '#F4F6FA',   // page background
  card:     '#FFFFFF',   // card surface
  cardAlt:  '#F8F9FD',   // inner alt surface

  // ── Text
  text:          '#1A1D2E',
  textSub:       '#6E7191',
  textSecondary: '#6E7191',  // legacy alias
  textMuted:     '#A8AECB',

  // ── Primary (blue)
  primary:      '#1E90FF',
  primaryLight: '#E6F2FF',
  primaryDark:  '#0070D8',
  primaryGlow:  '#E6F2FF',  // legacy alias

  // ── Status
  success:      '#2ECC9A',
  successLight: '#E5FAF2',
  danger:       '#FF6B6B',
  dangerLight:  '#FFE8E8',
  warning:      '#F59E0B',
  warningLight: '#FFF3DC',

  // ── Legacy / unused aliases (kept for backward compat)
  background:   '#F4F6FA',
  bgCard:       '#FFFFFF',
  bgCardHigh:   '#F8F9FD',
  surface:      '#FFFFFF',
  surfaceBorder:'#E8EAF0',
  glass:        '#FFFFFF',
  glassBorder:  '#E8EAF0',
  overlay:      'rgba(26,29,46,0.40)',
  gradientTop:  '#EEF0FF',
  gradientMid:  '#F4F6FA',
  gradientBot:  '#F4F6FA',
};

// ─── Card border (replaces shadows) ─────────────────────────────────────────
export const CARD_SHADOW = {
  borderWidth: 1,
  borderColor: '#E8EAF0',
};

export const CARD_SHADOW_SM = {
  borderWidth: 1,
  borderColor: '#E8EAF0',
};

// ─── Card design tokens ────────────────────────────────────────────────────────
export const CARD_BG     = '#FFFFFF';
export const CARD_BORDER = '#E8EAF0';
export const DIVIDER_COLOR = '#EEF0F6';

// ─── Pastel accent palettes (reference image colors) ──────────────────────────
export const ACCENT = {
  peach:  { bg: '#FFF3EB', color: '#FF9A56', border: '#FFD9B8', text: '#C05C10' },
  purple: { bg: '#EEE8FF', color: '#9B8CFF', border: '#D5CCFF', text: '#5030C0' },
  pink:   { bg: '#FFE8F0', color: '#FF7DA0', border: '#FFCCD9', text: '#C02050' },
  coral:  { bg: '#FFE8E8', color: '#FF7070', border: '#FFCCCC', text: '#C01010' },
  blue:   { bg: '#E8EEFF', color: '#6B7CFF', border: '#C8D0FF', text: '#3040C0' },
  green:  { bg: '#E5FAF2', color: '#2ECC9A', border: '#AAECD8', text: '#0A6045' },
};

// ─── Pexels query per screen ──────────────────────────────────────────────────
// Queries are picked randomly from the pool each time a screen refreshes.
// They target visually rich but dark images that pair well with glass effects.
export const SCREEN_BACKGROUNDS: Record<string, string[]> = {
  dashboard: [
    'morning',
    'Breathtaking sunset',
    'breathtaking mountain landscape',
    'Peaceful sunrise',
  ],
  tasks: [
    'productivity minimal desk clean',
    'checklist notebook flat lay',
    'workspace organised minimal white',
    'focus work light airy',
  ],
  projects: [
    'minimal clean workspace desk',
    'creative studio light airy',
    'white marble texture minimal',
    'soft geometric pattern light',
  ],
  calendar: [
    'calendar planner minimal clean',
    'soft pastel schedule notebook',
    'time management minimal white',
    'planning desk flat lay light',
  ],
  assistant: [
    'soft blue abstract light',
    'technology clean minimal white',
    'glowing orb soft light',
    'wave abstract pastel light',
  ],
  history: [
    'calm ocean sunrise pastel',
    'soft light bokeh white',
    'minimal architecture bright',
    'clean lines light airy',
  ],
  settings: [
    'minimal white interior clean',
    'soft stone texture light',
    'calm zen garden light',
    'bright airy clean space',
  ],
};

// ─── Priority config ──────────────────────────────────────────────────────────
export const PRIORITY_CONFIG = {
  low:    { label: 'Low',    color: '#2ECC9A', bg: '#E5FAF2' },
  medium: { label: 'Medium', color: '#F59E0B', bg: '#FFF3DC' },
  high:   { label: 'High',   color: '#FF7043', bg: '#FFF0EB' },
  urgent: { label: 'Urgent', color: '#FF4444', bg: '#FFE8E8' },
};

// ─── Escalation levels ────────────────────────────────────────────────────────
export const ESCALATION_CONFIG = [
  { level: 1, label: 'Gentle', intervalMin: 5 },
  { level: 2, label: 'Persistent', intervalMin: 15 },
  { level: 3, label: 'Loud', intervalMin: 30 },
  { level: 4, label: 'Alarm', intervalMin: 60 },
];

// ─── Reminder modes ───────────────────────────────────────────────────────────
export const REMINDER_MODES = ['gentle', 'strict', 'military', 'motivational', 'aggressive'] as const;

// ─── Reminder phrases per mode ────────────────────────────────────────────────
export const REMINDER_PHRASES: Record<string, string[]> = {
  gentle: [
    "Hey, just a gentle reminder about: {task}",
    "When you get a moment, don't forget: {task}",
    "A friendly nudge — you still need to: {task}",
  ],
  strict: [
    "You need to complete this now: {task}",
    "This task is still pending: {task}. Please handle it.",
    "Action required: {task}",
  ],
  military: [
    "Attention! Mission incomplete: {task}. Execute immediately.",
    "Status: PENDING. Task: {task}. No excuses.",
    "You are behind schedule. Complete: {task}. Now.",
  ],
  motivational: [
    "You've got this! Finish what you started: {task}",
    "One step closer to greatness. Complete: {task}",
    "Champions follow through. Your task: {task}",
  ],
  aggressive: [
    "Still haven't done it?! {task}. Do it NOW.",
    "You've been ignoring this for too long: {task}. No more delays.",
    "This will NOT go away. Complete: {task} immediately.",
  ],
};

// ─── Communication types ──────────────────────────────────────────────────────
export const COMMUNICATION_TYPES = ['call', 'email', 'message', 'meeting', 'apology', 'follow-up', 'inform'] as const;

// ─── App info ─────────────────────────────────────────────────────────────────
export const APP_NAME = 'Pieter';
export const DB_NAME = 'pieter.db';

// ─── UUID generator (crypto.randomUUID is unavailable in Hermes) ─────────────
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
