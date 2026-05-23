import type { PexelsPhoto } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY ?? '';
const BASE_URL = 'https://api.pexels.com/v1';

export async function fetchBackgroundPhoto(query: string): Promise<PexelsPhoto | null> {
  try {
    // Randomise the page so successive app launches show different images
    const page = Math.floor(Math.random() * 5) + 1;
    const url = `${BASE_URL}/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=20&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photos: PexelsPhoto[] = data.photos ?? [];
    if (photos.length === 0) return null;
    return photos[Math.floor(Math.random() * photos.length)];
  } catch {
    return null;
  }
}

export async function fetchCuratedPhoto(): Promise<PexelsPhoto | null> {
  try {
    const page = Math.floor(Math.random() * 10) + 1;
    const res = await fetch(`${BASE_URL}/curated?per_page=20&page=${page}`, {
      headers: { Authorization: API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photos: PexelsPhoto[] = data.photos ?? [];
    if (photos.length === 0) return null;
    return photos[Math.floor(Math.random() * photos.length)];
  } catch {
    return null;
  }
}

