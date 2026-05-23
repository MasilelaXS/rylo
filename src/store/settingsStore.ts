import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AppSettings } from '../types';

const SETTINGS_KEY = '@pieter_settings';

interface SettingsStore {
  settings: AppSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  update: (partial: Partial<AppSettings>) => void;
}

const defaults: AppSettings = {
  userName: '',
  reminderMode: 'strict',
  voiceEnabled: true,
  speechRate: 1.0,
  selectedVoice: '',
  selectedVoiceId: '',
  escalationEnabled: true,
  morningBriefingEnabled: true,
  eveningBriefingEnabled: true,
  morningBriefingTime: '08:00',
  eveningBriefingTime: '20:00',
  backgroundsEnabled: true,
  hourlyRemindersEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  currentStreak: 0,
  longestStreak: 0,
  lastCompletionDate: '',
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaults,
  loaded: false,

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        set({ settings: { ...defaults, ...parsed }, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  update: (partial) =>
    set((s) => {
      const next = { ...s.settings, ...partial };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return { settings: next };
    }),
}));
