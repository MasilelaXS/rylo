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
}

// ─── UI Helper Types ──────────────────────────────────────────────────────────
export interface DailyStats {
  total: number;
  completed: number;
  overdue: number;
  pending: number;
}
