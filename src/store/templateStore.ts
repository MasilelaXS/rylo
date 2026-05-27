import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { Priority, RepeatType } from '../types';
import { generateId } from '../utils/constants';

const TEMPLATES_KEY = '@pieter_task_templates';

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: Priority;
  estimatedMinutes: number;
  repeatType: RepeatType;
  location: string;
}

interface TemplateStore {
  templates: TaskTemplate[];
  loaded: boolean;
  load: () => Promise<void>;
  addTemplate: (t: Omit<TaskTemplate, 'id'>) => Promise<void>;
  updateTemplate: (id: string, partial: Partial<Omit<TaskTemplate, 'id'>>) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
}

const DEFAULTS: TaskTemplate[] = [
  { id: 'tpl_review',   name: 'Weekly Review',   title: 'Weekly review',          description: 'Review completed tasks, plan next week', priority: 'medium', estimatedMinutes: 30,  repeatType: 'weekly',  location: '' },
  { id: 'tpl_email',    name: 'Email Catch-up',  title: 'Process inbox',           description: 'Clear and respond to all emails',          priority: 'medium', estimatedMinutes: 20,  repeatType: 'daily',   location: '' },
  { id: 'tpl_call',     name: 'Client Call',     title: 'Call with client',        description: 'Scheduled client check-in',                priority: 'high',   estimatedMinutes: 45,  repeatType: 'none',    location: '' },
  { id: 'tpl_report',   name: 'Status Report',   title: 'Write status report',     description: 'Summarise progress for stakeholders',      priority: 'high',   estimatedMinutes: 60,  repeatType: 'weekly',  location: '' },
];

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
      if (raw) {
        set({ templates: JSON.parse(raw) as TaskTemplate[], loaded: true });
      } else {
        // Seed defaults on first run
        await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(DEFAULTS));
        set({ templates: DEFAULTS, loaded: true });
      }
    } catch {
      set({ templates: DEFAULTS, loaded: true });
    }
  },

  addTemplate: async (t) => {
    const tpl: TaskTemplate = { ...t, id: generateId() };
    const next = [...get().templates, tpl];
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)).catch(() => {});
    set({ templates: next });
  },

  updateTemplate: async (id, partial) => {
    const next = get().templates.map((t) => t.id === id ? { ...t, ...partial } : t);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)).catch(() => {});
    set({ templates: next });
  },

  removeTemplate: async (id) => {
    const next = get().templates.filter((t) => t.id !== id);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(next)).catch(() => {});
    set({ templates: next });
  },
}));
