import { useEffect } from 'react';
import type { Feed } from './api';
import { feedInfo } from './feeds';
import { shareUrl, siteUrl } from './format';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from './site';

// Story pages reproduce a discussion that lives on news.ycombinator.com, and
// search and saved views are per-reader, so none of them belong in an index.
// They stay crawlable so the links they carry are still followed.
const NOINDEX = 'noindex, follow';

export type Page =
  | { kind: 'feed'; feed: Feed }
  | { kind: 'search'; query: string }
  | { kind: 'saved' }
  | { kind: 'invalid' }
  | { kind: 'story'; id: number; title?: string };

export type PageMeta = { title: string; description: string; canonical?: string; robots?: string };

// A canonical never carries the article or panes params: the pane layout is a
// reading arrangement rather than a different page, the same judgement
// shareUrl makes for a link someone sends on.
export function pageMeta(page: Page): PageMeta {
  switch (page.kind) {
    case 'feed':
      return page.feed === 'top'
        ? { title: SITE_TITLE, description: SITE_DESCRIPTION, canonical: siteUrl('') }
        : { title: `${feedInfo[page.feed].title} — ${SITE_NAME}`, description: feedInfo[page.feed].description, canonical: siteUrl(`?feed=${page.feed}`) };
    case 'search':
      return { title: `${page.query} — ${SITE_NAME}`, description: `Hacker News stories matching “${page.query}”.`,
        canonical: siteUrl(`?q=${encodeURIComponent(page.query)}`), robots: NOINDEX };
    case 'saved':
      return { title: `Saved — ${SITE_NAME}`, description: 'The stories you kept for later.', canonical: siteUrl('?feed=saved'), robots: NOINDEX };
    case 'invalid':
      return { title: `Nothing to read here — ${SITE_NAME}`, description: SITE_DESCRIPTION, robots: NOINDEX };
    case 'story':
      return { title: `${page.title ?? 'Story unavailable'} — ${SITE_NAME}`, description: SITE_DESCRIPTION, canonical: shareUrl(page.id), robots: NOINDEX };
  }
}

// index.html ships a description and a canonical for the crawlers that never
// run any of this, so the tags are updated in place rather than appended:
// a second canonical would leave the page with two conflicting ones.
function setMeta(name: string, content?: string) {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!content) { existing?.remove(); return; }
  const element = existing ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name }));
  element.content = content;
}
function setCanonical(href?: string) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) { existing?.remove(); return; }
  const element = existing ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'canonical' }));
  element.href = href;
}

// A null page leaves the head alone, so the one view that owns the page — the
// open story, or the feed behind it — describes it without the other racing it.
export function usePageMeta(page: Page | null) {
  const meta = page && pageMeta(page);
  const { title, description, canonical, robots } = meta ?? {};
  useEffect(() => {
    if (!title || !description) return;
    document.title = title;
    setMeta('description', description);
    setMeta('robots', robots);
    setCanonical(canonical);
  }, [title, description, canonical, robots]);
}
