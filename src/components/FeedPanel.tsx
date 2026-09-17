import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clearCache, getFeed, getItems, type Feed, type ItemResult } from '../api';
import { ExternalLink, Failure, FeedFooter, HideReadToggle, Icon, Skeleton } from './ui';
import { useViewSettings } from '../settings';
import StoryList from './StoryList';

const feedInfo = {
  top: { title: 'The front page', description: 'What’s catching the community’s attention.' },
  new: { title: 'Fresh off the keyboard', description: 'The latest submissions, as they arrive.' },
  best: { title: 'Worth your time', description: 'The stories that stayed with the community.' },
  ask: { title: 'A good question', description: 'Questions, perspectives, and collective wisdom.' },
  show: { title: 'Made by the community', description: 'Side projects, big ideas, and things people built.' },
};

export default function FeedPanel({ feed, active, enabled, selected, read, onRead, saved, onToggleSaved, hideRead, onHideRead, hrefSuffix, refreshAt, checkAt, onBusy }: {
  feed: Feed; active: boolean; enabled: boolean; selected: number | null; read: Set<number>; onRead: (id: number) => void;
  saved: Set<number>; onToggleSaved: (id: number) => void; hideRead: boolean; onHideRead: (on: boolean) => void; hrefSuffix: string;
  refreshAt: number; checkAt: number; onBusy: (busy: boolean) => void;
}) {
  const settings = useViewSettings();
  const [ids, setIds] = useState<number[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<number[]>([]);
  const generation = useRef(0);
  const scrolling = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);

  async function load(reset = false) {
    if (busy) return;
    const version = ++generation.current;
    setBusy(true); setError(false);
    try {
      const nextIds = reset || !loaded ? await getFeed(feed) : ids;
      const start = reset ? 0 : items.length;
      const result = await getItems(nextIds.slice(start, start + 30));
      if (version !== generation.current) return;
      setIds(nextIds); setItems(previous => reset ? result : [...previous, ...result]); setLoaded(true);
      if (reset) setPending([]);
    } catch { if (version === generation.current) setError(true); }
    finally { if (version === generation.current) setBusy(false); }
  }
  useEffect(() => {
    if (enabled && !loaded) void load(true);
    // A feed is loaded once on its first visit, then only on explicit refresh.
  }, [enabled]);
  useLayoutEffect(() => { if (active && scrolling.current) scrolling.current.scrollTop = scrollTop.current; }, [active]);
  useEffect(() => { if (active) onBusy(busy); }, [active, busy, onBusy]);
  useEffect(() => {
    if (refreshAt && active) void load(true);
  }, [refreshAt]);
  // Auto-refresh asks only for the id list: a story being read is never pulled
  // out from under the reader, so the new ones wait behind a pill instead.
  useEffect(() => {
    if (!checkAt || !active || !loaded) return;
    let current = true;
    void getFeed(feed, true).then(next => {
      if (!current) return;
      const known = new Set(ids);
      // The feed is a ranked list that reshuffles, so only the stretch a refresh
      // would render counts — a newcomer at rank 400 is not news to anyone.
      const fresh = next.slice(0, Math.max(30, items.length)).filter(id => !known.has(id));
      if (!fresh.length) return;
      if (!selected && (scrolling.current?.scrollTop ?? 0) < 40) void load(true);
      else setPending(fresh);
    }).catch(() => { /* A missed check is picked up by the next one. */ });
    return () => { current = false; };
  }, [checkAt]);

  async function retryItem(id: number) {
    const version = generation.current;
    const [result] = await getItems([id]);
    if (version === generation.current) setItems(previous => previous.map(item => item.id === id ? result : item));
  }

  // Filtering happens at render so pagination keeps counting every story the
  // feed returned, not only the visible ones.
  const shown = hideRead ? items.filter(({ id }) => id === selected || !read.has(id)) : items;
  return <section className="feed-panel" hidden={!active} aria-label={`${feed} stories`}>
    {settings.heading && <div className="feed-heading">
      <div><span className="eyebrow">YOUR DAILY CURIOSITY</span><h1>{feedInfo[feed].title}</h1><p>{feedInfo[feed].description}</p></div>
      <button className={`icon-button refresh ${busy ? 'is-loading' : ''}`} aria-label="Refresh stories" title="Refresh stories" disabled={busy} onClick={() => { clearCache(); void load(true); }}><Icon name="refresh" /></button>
    </div>}
    <div className="list-caption"><span>{busy ? 'UPDATING…' : 'STORIES'}</span><HideReadToggle on={hideRead} onChange={onHideRead} /></div>
    <div className="feed-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {pending.length > 0 && <button type="button" className="new-stories" onClick={() => { setPending([]); void load(true); }}>
        <span aria-hidden="true">↑</span> {pending.length} new {pending.length === 1 ? 'story' : 'stories'}</button>}
      {error && <Failure retry={() => void load(!loaded)}>Couldn’t load the stories. Your connection may need a moment.</Failure>}
      {!loaded && busy && <Skeleton rows={8} />}
      {loaded && !ids.length && <div className="small-empty">No stories here just yet. Check back soon.</div>}
      {loaded && ids.length > 0 && !shown.length && <div className="small-empty">Every story here is read. Turn off “Hide read” to see them again.</div>}
      <StoryList items={shown} selected={selected} read={read} onRead={onRead} saved={saved} onToggleSaved={onToggleSaved} onRetry={id => void retryItem(id)}
        href={id => `/item?id=${id}&feed=${feed}${hrefSuffix}`} fallbackSource={feed === 'ask' ? 'Ask HN' : 'Hacker News'} />
      {loaded && items.length < ids.length && <div className="load-more-wrap"><button className="secondary-button" disabled={busy} onClick={() => void load()}>{busy ? 'Loading stories…' : 'Load more stories'} <span aria-hidden="true">↓</span></button><span className="load-caption">{items.length} of {ids.length} stories</span></div>}
      {loaded && items.length > 0 && items.length >= ids.length && <p className="end-note">You’re all caught up. A good time for a little break.</p>}
    </div>
    <FeedFooter>Powered by the Hacker News community<ExternalLink href="https://news.ycombinator.com">news.ycombinator.com <Icon name="arrow" size={12} /></ExternalLink></FeedFooter>
  </section>;
}
