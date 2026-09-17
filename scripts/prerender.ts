// Runs after `vite build`. The app ships an empty #root, so anything that does
// not run JavaScript sees a blank page; this snapshots the front page out of a
// real browser and writes the three HTML entry points GitHub Pages serves.
//
// Only / and /item can differ: Pages picks a file by path alone, so every
// ?feed= and ?q= URL is served by dist/index.html whatever it contains.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { feeds } from '../src/api.ts';
import { SITE_URL } from '../src/site.ts';

const NOINDEX = '<meta name="robots" content="noindex, follow" />';
const shell = await readFile('dist/index.html', 'utf8');

// The app rewrites the canonical to the origin it is running on, which during
// the snapshot is the preview server.
const canonical = (html: string, href: string) => html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${href}" />`);
// A story or an unknown path has no canonical until the app knows which one it
// is; the site root would be the wrong answer for both.
const uncanonical = (html: string) => html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>\n\s*/, '');
// Story pages reproduce a discussion that lives on news.ycombinator.com, and an
// unknown path is nothing at all. Both say so without waiting for the app.
const noindex = (html: string) => html.replace('</head>', `  ${NOINDEX}\n  </head>`);

async function snapshot() {
  const server = await preview({ preview: { port: 4188, strictPort: true } });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls?.local[0] ?? 'http://localhost:4188/');
    await page.waitForSelector('.feed-panel:not([hidden]) [data-story-id]', { timeout: 30_000 });
    return `<!doctype html>\n${await page.evaluate(() => document.documentElement.outerHTML)}\n`;
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  }
}

let front = shell;
try {
  front = canonical(await snapshot(), `${SITE_URL}/`);
} catch (error) {
  // The front page is rendered from the live Hacker News API, so a snapshot can
  // fail for reasons that have nothing to do with the build. Ship the shell.
  console.warn(`prerender: falling back to the plain shell — ${error instanceof Error ? error.message : String(error)}`);
}

const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...feeds.filter(feed => feed !== 'top').map(feed => `/?feed=${feed}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(path => `  <url><loc>${SITE_URL}${path.replace(/&/g, '&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;

await writeFile('dist/index.html', front);
// Without its own file /item?id=N falls through to 404.html, which GitHub Pages
// serves with a 404 status no crawler will index. It is item.html rather than
// item/index.html because Pages redirects a directory to its trailing slash,
// and the reader would have to recognise that URL too.
await writeFile('dist/item.html', noindex(uncanonical(shell)));
await writeFile('dist/404.html', noindex(uncanonical(shell)));
await writeFile('dist/sitemap.xml', sitemap);
console.log(`prerender: wrote index.html${front === shell ? ' (shell)' : ''}, item.html, 404.html, sitemap.xml`);
