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
export function plainTitle(value = 'Untitled story') {
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
}
export function sanitize(value: string) {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'a', 'em', 'i', 'strong', 'b', 'code', 'pre', 'blockquote', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title'],
  });
  for (const link of template.content.querySelectorAll('a')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return template.innerHTML;
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
export const hnUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`;
