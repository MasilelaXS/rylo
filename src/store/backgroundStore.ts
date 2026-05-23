import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { fetchBackgroundPhoto } from '../services/pexels';
import type { PexelsPhoto } from '../types';
import { SCREEN_BACKGROUNDS } from '../utils/constants';

const CACHE_TTL_MS  = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX  = '@bg_cache_';

interface CacheEntry {
  photo: PexelsPhoto;
  fetchedAt: number;
}

interface BackgroundStore {
  backgrounds: Record<string, PexelsPhoto | null>;
  fetchBackground: (screen: string) => Promise<void>;
}

export const useBackgroundStore = create<BackgroundStore>((set, get) => ({
  backgrounds: {},

  fetchBackground: async (screen: string) => {
    // 1. Return immediately if already loaded this session
    if (get().backgrounds[screen]) return;

    // 2. Check persistent cache with TTL
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + screen);
      if (raw) {
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
          set((s) => ({ backgrounds: { ...s.backgrounds, [screen]: entry.photo } }));
          return;
        }
      }
    } catch { /* ignore stale/corrupt cache */ }

    // 3. Fetch fresh from Pexels
    const pool  = SCREEN_BACKGROUNDS[screen] ?? ['hd background'];
    const query = pool[Math.floor(Math.random() * pool.length)];
    const photo = await fetchBackgroundPhoto(query);

    if (photo) {
      const entry: CacheEntry = { photo, fetchedAt: Date.now() };
      AsyncStorage.setItem(CACHE_PREFIX + screen, JSON.stringify(entry)).catch(() => {});
    }
    set((s) => ({ backgrounds: { ...s.backgrounds, [screen]: photo } }));
  },
}));
