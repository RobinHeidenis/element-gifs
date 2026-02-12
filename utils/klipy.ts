/**
 * Klipy API integration
 */

const KLIPY_API_BASE = 'https://api.klipy.com';

// Cache duration in milliseconds
const TRENDING_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let apiKey: string | null = null;

// In-memory cache for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<KlipyGif[]>>();

function getCached(key: string, maxAge: number): KlipyGif[] | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > maxAge) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: KlipyGif[]): void {
  cache.set(key, { data, timestamp: Date.now() });
}

interface KlipyFileFormat {
  url: string;
  width: number;
  height?: number;
}

interface KlipyFileSize {
  gif?: KlipyFileFormat;
  webp?: KlipyFileFormat;
  mp4?: KlipyFileFormat;
  webm?: KlipyFileFormat;
  jpg?: KlipyFileFormat;
}

export interface KlipyGif {
  id: number;
  slug: string;
  title: string;
  blur_preview?: string;
  file: {
    hd?: KlipyFileSize;
    md?: KlipyFileSize;
    sm?: KlipyFileSize;
    xs?: KlipyFileSize;
  };
  tags?: string[];
  type: string;
}

interface KlipyResponse {
  result: boolean;
  data: {
    current_page: number;
    data: KlipyGif[];
    has_next: boolean;
    per_page: number;
    meta?: {
      item_min_width?: number;
      ad_max_resize_percent?: number;
    };
  };
}

/**
 * Get stored API key
 */
export async function getApiKey(): Promise<string | null> {
  if (apiKey) return apiKey;

  const result = await storage.getItem<string>('local:klipyApiKey');
  apiKey = result || null;
  return apiKey;
}

/**
 * Save API key
 */
export async function saveApiKey(key: string): Promise<void> {
  await storage.setItem('local:klipyApiKey', key);
  apiKey = key;
}

/**
 * Get paste link inline setting
 */
export async function getPasteLinkInline(): Promise<boolean> {
  const result = await storage.getItem<boolean>('local:pasteLinkInline');
  return result ?? false;
}

/**
 * Save paste link inline setting
 */
export async function savePasteLinkInline(value: boolean): Promise<void> {
  await storage.setItem('local:pasteLinkInline', value);
}

/**
 * Fetch trending GIFs from Klipy
 */
export async function fetchTrendingGifs(page = 1): Promise<KlipyGif[]> {
  const cacheKey = `trending:${page}`;
  const cached = getCached(cacheKey, TRENDING_CACHE_DURATION);
  if (cached) {
    console.log('[Element GIFs] Using cached trending GIFs');
    return cached;
  }

  const key = await getApiKey();
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      page: String(page),
      per_page: '20',
      locale: navigator.language || 'en',
    });
    const res = await fetch(
      `${KLIPY_API_BASE}/api/v1/${key}/gifs/trending?${params}`
    );
    const response: KlipyResponse = await res.json();
    const gifs = response.data?.data || [];

    setCache(cacheKey, gifs);
    return gifs;
  } catch (err) {
    console.error('[Element GIFs] Error fetching trending:', err);
    return [];
  }
}

/**
 * Search GIFs from Klipy
 */
export async function searchGifs(query: string, page = 1): Promise<KlipyGif[]> {
  const cacheKey = `search:${query}:${page}`;
  const cached = getCached(cacheKey, SEARCH_CACHE_DURATION);
  if (cached) {
    console.log('[Element GIFs] Using cached search results');
    return cached;
  }

  const key = await getApiKey();
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      per_page: '20',
      locale: navigator.language || 'en',
    });
    const res = await fetch(
      `${KLIPY_API_BASE}/api/v1/${key}/gifs/search?${params}`
    );
    const response: KlipyResponse = await res.json();
    const gifs = response.data?.data || [];

    setCache(cacheKey, gifs);
    return gifs;
  } catch (err) {
    console.error('[Element GIFs] Error searching GIFs:', err);
    return [];
  }
}

