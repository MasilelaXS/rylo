// ─── Task Types ───────────────────────────────────────────────────────────────
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'snoozed' | 'cancelled';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';
export type ReminderMode = 'gentle' | 'strict' | 'military' | 'motivational' | 'aggressive';
export type CommunicationType = 'call' | 'email' | 'message' | 'meeting' | 'apology' | 'follow-up' | 'inform';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: number; // unix timestamp ms
  priority: Priority;
  status: TaskStatus;
  escalationLevel: number;
  projectId: string | null;
  repeatType: RepeatType;
  voiceReminderEnabled: boolean;
  communicationTarget: string | null;
  snoozeCount: number;
  createdAt: number;
  completedAt?: number;   // unix ms, set when status→completed
  location?: string;
  estimatedMinutes?: number; // 0 = unset
  // ─── Execution-Enforcement extensions ─────────────────
  committed?: boolean;                 // commitment-contract task
  category?: 'communication' | 'deep_work' | 'admin' | 'personal' | 'general';
  commStatus?: 'pending' | 'attempted' | 'confirmed';
  difficulty?: 1 | 2 | 3 | 4 | 5;
  dependsOn?: string | null;           // ID of the task that blocks this one
  timeLoggedMinutes?: number;          // cumulative focus time logged (minutes)
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
}

export interface Reminder {
  id: string;
  taskId: string;
  reminderTime: number; // unix timestamp ms
  escalationLevel: number;
  completed: number; // 0 | 1 (SQLite boolean)
}

export interface CommunicationLog {
  id: string;
  taskId: string;
  personName: string;
  communicationType: CommunicationType;
  outcome: string;
  draftMessage: string;
  urgency: Urgency;
  timestamp: number;
}

// ─── Note Types ───────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
}

// ─── Subtask Types ────────────────────────────────────────────────────────────
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: number;
}

// ─── Pexels Types ─────────────────────────────────────────────────────────────
export interface PexelsPhotoSrc {
  original: string;
  large2x: string;
  large: string;
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
}

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  avg_color: string;
  src: PexelsPhotoSrc;
  alt: string;
}

// ─── Store Types ──────────────────────────────────────────────────────────────
export interface AppSettings {
  userName: string;          // personalises hourly notifications
  reminderMode: ReminderMode;
  voiceEnabled: boolean;
  speechRate: number; // 0.5 – 2.0
  selectedVoice: string;
  selectedVoiceId: string; // expo-speech voice identifier
  escalationEnabled: boolean;
  morningBriefingEnabled: boolean;
  eveningBriefingEnabled: boolean;
  morningBriefingTime: string; // "08:00"
  eveningBriefingTime: string; // "20:00"
  backgroundsEnabled: boolean;
  hourlyRemindersEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
  currentStreak: number;   // consecutive days with ≥1 completion
  longestStreak: number;
  lastCompletionDate: string; // ISO date string YYYY-MM-DD
  reliabilityAcknowledged: boolean; // user opened battery/exact-alarm settings
}

// ─── UI Helper Types ──────────────────────────────────────────────────────────
export interface DailyStats {
  total: number;
  completed: number;
  overdue: number;
  pending: number;
}

// ─── Execution-Enforcement Types ──────────────────────────────────────────────
export interface Excuse {
  id: string;
  taskId: string;
  reason: string;
  category: string; // free-form tag like "tired", "no time", "afraid", etc.
  createdAt: number;
}

export interface Commitment {
  id: string;
  taskId: string;
  contact: string;          // phone / email / name
  accountabilityMessage: string;
  triggered: boolean;       // 0|1 — has the accountability fired?
  createdAt: number;
}

export interface FollowUp {
  id: string;
  sourceTaskId: string;     // task that was completed and spawned this chase
  chaseTaskId: string;      // newly created chase task
  expectedReplyAt: number;  // unix ms
  createdAt: number;
}

export interface CommDraft {
  id: string;
  taskId: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'other';
  recipient: string;
  body: string;
  sentAt?: number;
  createdAt: number;
}

export interface VoiceNote {
  id: string;
  transcript: string;
  audioUri?: string;
  durationMs?: number;
  taskCount: number;      // # tasks extracted
  createdAt: number;
}

export type StreakCategory = 'communication' | 'deep_work' | 'admin' | 'personal' | 'general';

export interface CategoryStreak {
  category: StreakCategory;
  current: number;
  longest: number;
  lastCompletionDate: string; // YYYY-MM-DD
}

// Extra task columns (added in this iteration)
export interface TaskExt {
  committed?: boolean;
  category?: StreakCategory;
  commStatus?: 'pending' | 'attempted' | 'confirmed';
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

// ─── Habit Types ─────────────────────────────────────────────────────────────
export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  targetDays: number[]; // 0-6 (Sun=0) used for weekly habits; empty = every day
  createdAt: number;
  archived: boolean;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  completedDate: string; // YYYY-MM-DD
  createdAt: number;
}

// ─── Mood/Energy Types ────────────────────────────────────────────────────────
export interface MoodLog {
  id: string;
  logDate: string;     // YYYY-MM-DD
  energy: number;      // 1-5
  mood: number;        // 1-5
  note: string;
  createdAt: number;
}
