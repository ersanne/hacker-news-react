export const feeds = ['top', 'new', 'best', 'ask', 'show'] as const;
export type Feed = typeof feeds[number];
export type HNItem = {
  id: number;
  type?: 'story' | 'comment' | 'job' | 'poll' | 'pollopt';
  title?: string;
  url?: string;
  text?: string;
  by?: string;
  time?: number;
  score?: number;
  descendants?: number;
  kids?: number[];
  deleted?: boolean;
  dead?: boolean;
};

const TTL = 5 * 60 * 1000;
const cache = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
let active = 0;
const queue: (() => void)[] = [];

async function limited<T>(work: () => Promise<T>): Promise<T> {
  await new Promise<void>(resolve => {
    const start = () => { active++; resolve(); };
    if (active < 8) start(); else queue.push(start);
  });
  try { return await work(); }
  finally { active--; queue.shift()?.(); }
}

async function request<T>(path: string): Promise<T> {
  const saved = cache.get(path);
  if (saved && saved.expires > Date.now()) return saved.value as T;
  if (pending.has(path)) return pending.get(path) as Promise<T>;
  const promise = limited(async () => {
    const response = await fetch(`https://hacker-news.firebaseio.com/v0/${path}.json`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Hacker News could not be reached. Please try again.');
    const value: T = await response.json();
    cache.delete(path);
    cache.set(path, { value, expires: Date.now() + TTL });
    if (cache.size > 3000) cache.delete(cache.keys().next().value!);
    return value;
  });
  pending.set(path, promise);
  try { return await promise; }
  finally { pending.delete(path); }
}

export function getItem(id: number) { return request<HNItem | null>(`item/${id}`); }
export function getFeed(feed: Feed) { return request<number[]>(`${feed}stories`); }
export function clearCache() { cache.clear(); }

export type ItemResult = { id: number; item: HNItem | null; error: boolean };
export async function getItems(ids: number[]): Promise<ItemResult[]> {
  return Promise.all(ids.map(async id => {
    try { return { id, item: await getItem(id), error: false }; }
    catch { return { id, item: null, error: true }; }
  }));
}
