import DOMPurify from 'dompurify';

export function safeUrl(value?: string) {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
export function domain(value?: string) {
  const url = safeUrl(value);
  return url ? new URL(url).hostname.replace(/^www\./, '') : '';
}
// DuckDuckGo's icon service takes a bare hostname and needs no API key.
export function faviconUrl(host: string) {
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
}
export function plainTitle(value = 'Untitled story') {
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
}
const COMMENT_TAGS = ['p', 'a', 'em', 'i', 'strong', 'b', 'code', 'pre', 'blockquote', 'br', 'ul', 'ol', 'li'];
const ARTICLE_TAGS = [...COMMENT_TAGS, 'h1', 'h2', 'h3', 'h4', 'hr', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];

function clean(value: string, tags: string[], attributes: string[]) {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(value, { ALLOWED_TAGS: tags, ALLOWED_ATTR: attributes });
  for (const link of template.content.querySelectorAll('a')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return template.innerHTML;
}
export function sanitize(value: string) {
  return clean(value, COMMENT_TAGS, ['href', 'title']);
}
// Extracted article markdown renders headings, images and tables that comment
// HTML never contains, so it gets its own wider allowlist.
export function sanitizeArticle(value: string) {
  return clean(value, ARTICLE_TAGS, ['href', 'title', 'src', 'alt']);
}
export function readingTime(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}
export function ago(timestamp?: number) {
  if (!timestamp) return 'unknown time';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always', style: 'short' });
  if (seconds < 3600) return formatter.format(-Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return formatter.format(-Math.floor(seconds / 3600), 'hour');
  return formatter.format(-Math.floor(seconds / 86400), 'day');
}
// archive.is resolves /newest/<url> to the most recent snapshot, and offers to
// capture one when it has none.
export const archiveUrl = (url: string) => `https://archive.is/newest/${url}`;
export const hnUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`;
