import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getArticle, getComments, getFeed, getItem, getItems, prefetchStory, searchStories } from './api';

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

  it('flattens the Algolia comment tree and marks deleted comments', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return response({
      id: 7,
      children: [
        { id: 71, author: 'ada', text: '<p>First</p>', created_at_i: 1700000000, children: [
          { id: 711, author: null, text: null, created_at_i: 1700000100, children: [
            { id: 7111, author: 'grace', text: '<p>Still here</p>', created_at_i: 1700000200, children: [] },
          ] },
        ] },
        { id: null, author: 'nobody', text: '<p>No id</p>' },
      ],
    }); }));
    expect(await getComments(7)).toEqual([
      { id: 71, by: 'ada', text: '<p>First</p>', time: 1700000000, removed: false, kids: [
        { id: 711, by: undefined, text: undefined, time: 1700000100, removed: true, kids: [
          { id: 7111, by: 'grace', text: '<p>Still here</p>', time: 1700000200, removed: false, kids: [] },
        ] },
      ] },
    ]);
    expect(urls[0]).toBe('https://hn.algolia.com/api/v1/items/7');
  });
  it('reports a discussion Algolia has not indexed yet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    await expect(getComments(9)).rejects.toThrow('could not be reached');
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
  it('returns extracted article markdown and rejects pages with no readable text', async () => {
    const fetcher = vi.fn(async (url: string) => response(url.includes('empty')
      ? { data: { title: 'Empty', content: '   ' } }
      : { data: { title: 'The Quiet Web', content: '# Heading\n\nBody text.' } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getArticle('https://example.com/a')).toEqual({ title: 'The Quiet Web', markdown: '# Heading\n\nBody text.' });
    expect(fetcher.mock.calls[0][0]).toBe('https://r.jina.ai/https://example.com/a');
    await expect(getArticle('https://example.com/empty')).rejects.toThrow('No readable article');
  });
  it('prefetches a story and its comments once, and retries after a failure', async () => {
    const fetcher = vi.fn(async () => response({ id: 5 }));
    vi.stubGlobal('fetch', fetcher);
    await prefetchStory(5);
    // The story from the item API and the whole thread from Algolia.
    expect(fetcher).toHaveBeenCalledTimes(2);
    await prefetchStory(5);
    expect(fetcher).toHaveBeenCalledTimes(2);

    clearCache();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false }) as Response));
    await prefetchStory(6);
    const retry = vi.fn(async () => response({ id: 6 }));
    vi.stubGlobal('fetch', retry);
    await prefetchStory(6);
    expect(retry).toHaveBeenCalledTimes(2);
  });
  it('drops a leading heading that only repeats the article title', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ data: { title: 'The Quiet Web — a blog', content: '# The Quiet Web\n\nBody text.' } })));
    expect((await getArticle('https://example.com/a')).markdown).toBe('Body text.');
  });
});
