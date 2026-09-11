import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getFeed, getItem, getItems, searchStories } from './api';

beforeEach(() => { clearCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const response = (value: unknown) => ({ ok: true, json: async () => value }) as Response;

describe('HN data client', () => {
  it('deduplicates in-flight requests and caches successful results', async () => {
    const fetcher = vi.fn(async () => response({ id: 1 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await Promise.all([getItem(1), getItem(1)])).toEqual([{ id: 1 }, { id: 1 }]);
    await getItem(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('expires cache after five minutes and supports explicit refresh', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const fetcher = vi.fn(async () => response([1, 2]));
    vi.stubGlobal('fetch', fetcher);
    await getFeed('top');
    clock.mockReturnValue(now + 300001);
    await getFeed('top');
    clearCache();
    await getFeed('top');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('preserves ordering and isolates failures, including null items', async () => {
    let failed = true;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const id = Number(url.match(/item\/(\d+)/)![1]);
      if (id === 2 && failed) throw new Error('Offline');
      if (id === 1) await new Promise(resolve => setTimeout(resolve, 10));
      return response(id === 3 ? null : { id });
    }));
    expect(await getItems([1, 2, 3])).toEqual([
      { id: 1, item: { id: 1 }, error: false },
      { id: 2, item: null, error: true },
      { id: 3, item: null, error: false },
    ]);
    failed = false;
    expect(await getItem(2)).toEqual({ id: 2 });
  });
  it('never runs more than eight requests at once', async () => {
    let concurrent = 0;
    let maximum = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      concurrent++; maximum = Math.max(maximum, concurrent);
      await new Promise(resolve => setTimeout(resolve, 4));
      concurrent--;
      return response({ id: 1 });
    }));
    await getItems(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(maximum).toBe(8);
  });
  it('rejects failed HTTP responses and allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(response({ id: 8 })));
    await expect(getItem(8)).rejects.toThrow('could not be reached');
    await expect(getItem(8)).resolves.toEqual({ id: 8 });
  });

  it('maps search hits to stories and reports paging', async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: string) => { urls.push(url); return response({
      hits: [
        { objectID: '31', title: 'A quiet release', url: 'https://example.com/a', author: 'ada', points: 91, num_comments: 12, created_at_i: 1700000000 },
        { objectID: '32', title: 'Ask HN: anything?', url: null, story_text: '<p>Text</p>', author: 'grace', points: null, num_comments: null, created_at_i: 1700000100 },
        { objectID: 'not-a-story' },
      ],
      nbPages: 4,
      nbHits: 97,
    }); });
    vi.stubGlobal('fetch', fetcher);
    const page = await searchStories('quiet release', 2);
    const url = new URL(urls[0]);
    expect(url.origin + url.pathname).toBe('https://hn.algolia.com/api/v1/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({ query: 'quiet release', tags: 'story', hitsPerPage: '30', page: '2' });
    expect(page).toEqual({
      pages: 4,
      total: 97,
      results: [
        { id: 31, error: false, item: { id: 31, type: 'story', title: 'A quiet release', url: 'https://example.com/a', text: undefined, by: 'ada', time: 1700000000, score: 91, descendants: 12 } },
        { id: 32, error: false, item: { id: 32, type: 'story', title: 'Ask HN: anything?', url: undefined, text: '<p>Text</p>', by: 'grace', time: 1700000100, score: undefined, descendants: undefined } },
      ],
    });
  });
  it('surfaces search transport failures and tolerates an empty payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(response({})));
    await expect(searchStories('rust')).rejects.toThrow('could not be reached');
    expect(await searchStories('rust')).toEqual({ results: [], pages: 0, total: 0 });
  });
});
