// Renders the share card and the PNG icons that public/ ships. Run by hand
// (`node scripts/og-image.ts`) and commit the output — the build never needs it.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const SANS = 'node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-standard-normal.woff2';
const SERIF = 'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2';

async function fontFace(family: string, path: string) {
  const data = await readFile(path);
  return `@font-face { font-family: '${family}'; font-weight: 100 1000; src: url(data:font/woff2;base64,${data.toString('base64')}) format('woff2'); }`;
}

const mark = (size: number, radius: number) => `
  <div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:#bd512e;color:#fffaf2;
              display:grid;place-items:center;font-family:'Newsreader';font-size:${size * 0.66}px;line-height:1">
    <span style="transform:translateY(-${size * 0.04}px)">Y</span>
  </div>`;

const card = `
  <div style="width:1200px;height:630px;background:#f7f6f2;display:flex;flex-direction:column;
              justify-content:center;gap:34px;padding:0 96px;font-family:'DM Sans';color:#302f2b">
    <div style="display:flex;align-items:center;gap:28px">
      ${mark(96, 26)}
      <div style="font-size:88px;font-weight:700;letter-spacing:-4px">hn<span style="font-weight:450">reader</span><span style="color:#b84926">.</span></div>
    </div>
    <div style="font-family:'Newsreader';font-size:44px;font-style:italic;color:#63625a">A quieter corner of Hacker News.</div>
    <div style="font-size:28px;color:#605f57;letter-spacing:-0.3px">Good stories, thoughtful conversations, and room to read.</div>
  </div>`;

// The maskable icon is the same square edge to edge: the launcher and iOS each
// crop it to their own shape.
const icon = (size: number) => `
  <div style="width:${size}px;height:${size}px;background:#bd512e;color:#fffaf2;display:grid;place-items:center;
              font-family:'Newsreader';font-size:${size * 0.62}px;line-height:1">
    <span style="transform:translateY(-${size * 0.03}px)">Y</span>
  </div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const fonts = `${await fontFace('DM Sans', SANS)}\n${await fontFace('Newsreader', SERIF)}`;

for (const [file, width, height, body] of [
  ['public/og-image.png', 1200, 630, card],
  ['public/icon-512.png', 512, 512, icon(512)],
  ['public/apple-touch-icon.png', 180, 180, icon(180)],
] as const) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<style>${fonts} body { margin: 0 }</style>${body}`);
  await page.evaluate(() => document.fonts.ready);
  await writeFile(file, await page.screenshot());
  console.log(`wrote ${file}`);
}
await browser.close();
