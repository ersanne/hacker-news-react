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

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const SEARCH_API = 'https://hn.algolia.com/api/v1/search';
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

async function request<T>(url: string): Promise<T> {
  const saved = cache.get(url);
  if (saved && saved.expires > Date.now()) return saved.value as T;
  if (pending.has(url)) return pending.get(url) as Promise<T>;
  const promise = limited(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Hacker News could not be reached. Please try again.');
    const value = await response.json() as T;
    cache.delete(url);
    cache.set(url, { value, expires: Date.now() + TTL });
    if (cache.size > 3000) cache.delete(cache.keys().next().value!);
    return value;
  });
  pending.set(url, promise);
  try { return await promise; }
  finally { pending.delete(url); }
}

export function getItem(id: number) { return request<HNItem | null>(`${HN_API}/item/${id}.json`); }
export function getFeed(feed: Feed) { return request<number[]>(`${HN_API}/${feed}stories.json`); }
export function clearCache() { cache.clear(); }

export type ItemResult = { id: number; item: HNItem | null; error: boolean };
export async function getItems(ids: number[]): Promise<ItemResult[]> {
  return Promise.all(ids.map(async id => {
    try { return { id, item: await getItem(id), error: false }; }
    catch { return { id, item: null, error: true }; }
  }));
}

export const SEARCH_PAGE_SIZE = 30;
type SearchHit = {
  objectID?: string;
  title?: string | null;
  url?: string | null;
  author?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at_i?: number | null;
  story_text?: string | null;
};
export type SearchPage = { results: ItemResult[]; pages: number; total: number };

// Algolia carries every field the story list renders, so results are shown as
// returned rather than refetched one by one from the item API.
export async function searchStories(query: string, page = 0): Promise<SearchPage> {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    hitsPerPage: String(SEARCH_PAGE_SIZE),
    page: String(page),
  });
  const data = await request<{ hits?: SearchHit[]; nbPages?: number; nbHits?: number }>(`${SEARCH_API}?${params}`);
  const results = (data.hits ?? []).flatMap<ItemResult>(hit => {
    const id = Number(hit.objectID);
    if (!Number.isSafeInteger(id) || id <= 0) return [];
    return [{
      id,
      error: false,
      item: {
        id,
        type: 'story',
        title: hit.title ?? undefined,
        url: hit.url ?? undefined,
        text: hit.story_text ?? undefined,
        by: hit.author ?? undefined,
        time: hit.created_at_i ?? undefined,
        score: hit.points ?? undefined,
        descendants: hit.num_comments ?? undefined,
      },
    }];
  });
  return { results, pages: data.nbPages ?? 0, total: data.nbHits ?? results.length };
}
