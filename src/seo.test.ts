import { describe, expect, it } from 'vitest';
import { pageMeta } from './seo';
import { SITE_DESCRIPTION, SITE_TITLE } from './site';

const origin = () => window.location.origin;

describe('page meta', () => {
  it('gives the front page the site title and the bare origin as its canonical', () => {
    expect(pageMeta({ kind: 'feed', feed: 'top' })).toEqual({ title: SITE_TITLE, description: SITE_DESCRIPTION, canonical: `${origin()}/` });
  });
  it('names each other feed and canonicalises it to its own URL', () => {
    const meta = pageMeta({ kind: 'feed', feed: 'ask' });
    expect(meta.title).toBe('A good question — HN Reader');
    expect(meta.description).toBe('Questions, perspectives, and collective wisdom.');
    expect(meta.canonical).toBe(`${origin()}/?feed=ask`);
    expect(meta.robots).toBeUndefined();
  });
  it('keeps search, saved and story pages out of the index but still followed', () => {
    expect(pageMeta({ kind: 'search', query: 'rust' }).robots).toBe('noindex, follow');
    expect(pageMeta({ kind: 'saved' }).robots).toBe('noindex, follow');
    expect(pageMeta({ kind: 'story', id: 42, title: 'A story' }).robots).toBe('noindex, follow');
    expect(pageMeta({ kind: 'invalid' }).robots).toBe('noindex, follow');
  });
  it('escapes the query in a search canonical', () => {
    const meta = pageMeta({ kind: 'search', query: 'a b&c' });
    expect(meta.title).toBe('a b&c — HN Reader');
    expect(meta.canonical).toBe(`${origin()}/?q=a%20b%26c`);
  });
  it('canonicalises a story to the story alone, without the pane layout', () => {
    expect(pageMeta({ kind: 'story', id: 42, title: 'A story' }).canonical).toBe(`${origin()}/item?id=42`);
  });
  it('titles a story that never loaded, and leaves an unknown URL without a canonical', () => {
    expect(pageMeta({ kind: 'story', id: 42 }).title).toBe('Story unavailable — HN Reader');
    expect(pageMeta({ kind: 'invalid' }).canonical).toBeUndefined();
  });
});
