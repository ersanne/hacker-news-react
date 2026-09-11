import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clearCache, searchStories, type ItemResult } from '../api';
import { ExternalLink, Failure, Icon, Skeleton } from './ui';
import StoryList from './StoryList';

export default function SearchPanel({ query, active, selected, read, onRead }: {
  query: string; active: boolean; selected: number | null; read: Set<number>; onRead: (id: number) => void;
}) {
  const [items, setItems] = useState<ItemResult[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const generation = useRef(0);
  const scrolling = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);

  async function load(next: number) {
    const version = ++generation.current;
    setBusy(true); setError(false);
    try {
      const result = await searchStories(query, next);
      if (version !== generation.current) return;
      setItems(previous => next === 0 ? result.results : [...previous, ...result.results]);
      setPage(next); setPages(result.pages); setTotal(result.total); setLoaded(true);
    } catch { if (version === generation.current) setError(true); }
    finally { if (version === generation.current) setBusy(false); }
  }
  useEffect(() => {
    void load(0);
    // The panel is keyed by the query, so a new search mounts a fresh panel.
  }, []);
  useLayoutEffect(() => { if (active && scrolling.current) scrolling.current.scrollTop = scrollTop.current; }, [active]);

  const heading = total === 1 ? '1 story found' : `${total.toLocaleString('en')} stories found`;
  return <section className="feed-panel" hidden={!active} aria-label={`Search results for ${query}`}>
    <div className="feed-heading">
      <div><span className="eyebrow">SEARCH</span><h1>{query}</h1><p>{loaded && !error ? heading : 'Searching the Hacker News archive.'}</p></div>
      <button className={`icon-button refresh ${busy ? 'is-loading' : ''}`} aria-label="Search again" title="Search again" disabled={busy} onClick={() => { clearCache(); void load(0); }}><Icon name="refresh" /></button>
    </div>
    <div className="list-caption"><span>RESULTS</span><span>{busy ? 'Searching…' : 'By relevance.'}</span></div>
    <div className="feed-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {error && <Failure retry={() => void load(page && items.length ? page : 0)}>Couldn’t run that search. Your connection may need a moment.</Failure>}
      {!loaded && busy && <Skeleton rows={8} />}
      {loaded && !items.length && <div className="small-empty"><p>Nothing matched “{query}”. Try a different wording.</p></div>}
      <StoryList items={items} selected={selected} read={read} onRead={onRead}
        href={id => `/item?id=${id}&q=${encodeURIComponent(query)}`} fallbackSource="Hacker News" />
      {loaded && page + 1 < pages && <div className="load-more-wrap"><button className="secondary-button" disabled={busy} onClick={() => void load(page + 1)}>{busy ? 'Searching…' : 'Load more results'} <span aria-hidden="true">↓</span></button><span className="load-caption">{items.length} of {total.toLocaleString('en')} results</span></div>}
      {loaded && items.length > 0 && page + 1 >= pages && <p className="end-note">That’s every match. A good time for a little break.</p>}
    </div>
    <footer className="feed-footer"><span className="live-dot" />Search by the Hacker News Algolia API<ExternalLink href="https://hn.algolia.com"><span className="sr-only">Visit HN Search</span><Icon name="arrow" size={14} /></ExternalLink></footer>
  </section>;
}
