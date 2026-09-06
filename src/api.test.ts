import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, getFeed, getItem, getItems } from './api';

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
});
