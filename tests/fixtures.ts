import type { Page } from '@playwright/test';
import type { HNItem } from '../src/api';

const titles = [
  'The quiet craft of building software that lasts',
  'Show HN: I built a tiny computer you can program with light',
  'What happens when you let a forest grow for 100 years?',
  'SQLite is not a toy database',
  'A love letter to the lost art of the personal website',
  'The surprising geometry of everyday things',
  'Ask HN: What are you working on this month?',
  'We put a distributed database on a single machine',
  'The beautiful simplicity of the Unix philosophy',
  'Someone is keeping the old internet alive',
];
const domains = ['maggieappleton.com', 'github.com', 'theatlantic.com', 'sqlite.org', 'anh.email', 'quantamagazine.org'];
export const fixtureItems: Record<number, HNItem | null> = {};
for (let id = 1; id <= 65; id++) fixtureItems[id] = {
  id, type: 'story', title: titles[(id - 1) % titles.length] + (id > 10 ? ` · ${id}` : ''),
  url: id === 7 ? undefined : `https://${domains[(id - 1) % domains.length]}/story/${id}`,
  text: id === 7 ? '<p>Tell us about something you’re making, big or small.</p>' : undefined,
  by: ['paulg', 'simonw', 'tosh', 'jbranchaud', 'ingve'][id % 5],
  score: 328 - id * 3, time: Math.floor(Date.now() / 1000) - id * 1800,
  descendants: id === 1 ? 28 : id === 7 ? 0 : 42 + id,
  kids: id === 1 ? Array.from({ length: 25 }, (_, i) => 100 + i) : [],
};
for (let id = 100; id < 125; id++) fixtureItems[id] = {
  id, type: 'comment', by: id === 100 ? 'simonw' : `reader${id}`, time: Math.floor(Date.now() / 1000) - 1800,
  text: id === 100 ? '<p>The best tools are the ones that give you room to think. There’s something to be said for software that does one thing, thoughtfully, and gets out of your way.</p><p>I keep coming back to this idea: maintenance is a design decision, not an afterthought.</p>' : `<p>Comment ${id}. I’ve found that the small details make the biggest difference over time. A thoughtful perspective and a good discussion.</p>`,
  kids: id === 100 ? [1000] : undefined,
};
fixtureItems[1000] = { id: 1000, type: 'comment', by: 'ada', text: '<p>A nested reply worth reading.</p>', kids: [2000] };
fixtureItems[2000] = { id: 2000, type: 'comment', deleted: true, kids: [3000] };
fixtureItems[3000] = { id: 3000, type: 'comment', by: 'grace', text: '<p>A surviving reply below a deleted comment.</p>', kids: [4000] };
fixtureItems[4000] = { id: 4000, type: 'comment', by: 'deepreader', text: `<pre><code>${'very_long_code_'.repeat(30)}</code></pre><p>${'unbroken'.repeat(80)}</p>` };
fixtureItems[999] = null;

export async function mockAPI(page: Page, options: { failItems?: Set<number>; delayItem?: number; releaseItem?: Promise<void>; failFeed?: boolean } = {}) {
  const requests: number[] = [];
  await page.route('https://hacker-news.firebaseio.com/v0/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const match = path.match(/item\/(\d+)\.json/);
    if (match) {
      const id = Number(match[1]); requests.push(id);
      if (id === options.delayItem) await (options.releaseItem ?? new Promise(resolve => setTimeout(resolve, 600)));
      if (options.failItems?.has(id)) return route.fulfill({ status: 503, body: 'Unavailable' });
      return route.fulfill({ json: fixtureItems[id] ?? null });
    }
    if (options.failFeed) return route.fulfill({ status: 503 });
    const ids = path.includes('newstories') ? [7, 2, 1] : path.includes('askstories') ? [7] : Array.from({ length: 65 }, (_, i) => i + 1);
    return route.fulfill({ json: ids });
  });
  return requests;
}

// The whole thread arrives from Algolia in one response, and a deleted comment
// keeps its place in the tree with no author or text.
type AlgoliaNode = { id: number; author: string | null; text: string | null; created_at_i: number | null; children: AlgoliaNode[] };
function thread(id: number): AlgoliaNode {
  const item = fixtureItems[id];
  const removed = !item || item.deleted;
  return {
    id, author: removed ? null : item.by ?? null, text: removed ? null : item.text ?? null,
    created_at_i: item?.time ?? null, children: (item?.kids ?? []).map(thread),
  };
}

export async function mockComments(page: Page, options: { failThreads?: Set<number> } = {}) {
  const threads: number[] = [];
  await page.route('https://hn.algolia.com/api/v1/items/*', route => {
    const id = Number(new URL(route.request().url()).pathname.split('/').pop());
    threads.push(id);
    if (options.failThreads?.has(id)) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.fulfill({ json: thread(id) });
  });
  return threads;
}

export async function mockSearch(page: Page, options: { fail?: boolean } = {}) {
  const queries: { query: string; page: number }[] = [];
  await page.route('https://hn.algolia.com/api/v1/search*', async route => {
    const params = new URL(route.request().url()).searchParams;
    const query = params.get('query') ?? '';
    const index = Number(params.get('page') ?? '0');
    const size = Number(params.get('hitsPerPage') ?? '30');
    queries.push({ query, page: index });
    if (options.fail) return route.fulfill({ status: 503, body: 'Unavailable' });
    const matches = Object.values(fixtureItems).filter(item => item?.type === 'story' && item.title?.toLowerCase().includes(query.toLowerCase()));
    const hits = matches.slice(index * size, index * size + size).map(item => ({
      objectID: String(item!.id), title: item!.title, url: item!.url ?? null, story_text: item!.text ?? null,
      author: item!.by, points: item!.score, num_comments: item!.descendants, created_at_i: item!.time,
    }));
    return route.fulfill({ json: { hits, nbHits: matches.length, nbPages: Math.ceil(matches.length / size), page: index } });
  });
  return queries;
}

export async function mockReader(page: Page, options: { fail?: boolean } = {}) {
  const urls: string[] = [];
  await page.route('https://r.jina.ai/**', async route => {
    const target = route.request().url().replace('https://r.jina.ai/', '');
    urls.push(target);
    if (options.fail) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.fulfill({ json: { data: { title: 'The quiet craft', content: `# The quiet craft\n\nExtracted body for ${target}.\n\n${'word '.repeat(300)}` } } });
  });
  return urls;
}

export async function mockSite(page: Page) {
  await page.route('https://maggieappleton.com/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Original</title><h1>The original page</h1>' }));
}
