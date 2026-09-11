import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clearCache, getFeed, getItems, type Feed, type ItemResult } from '../api';
import { ExternalLink, Failure, Icon, Skeleton } from './ui';
import StoryList from './StoryList';

const feedInfo = {
  top: { title: 'The front page', description: 'What’s catching the community’s attention.' },
  new: { title: 'Fresh off the keyboard', description: 'The latest submissions, as they arrive.' },
  best: { title: 'Worth your time', description: 'The stories that stayed with the community.' },
  ask: { title: 'A good question', description: 'Questions, perspectives, and collective wisdom.' },
  show: { title: 'Made by the community', description: 'Side projects, big ideas, and things people built.' },
};

export default function FeedPanel({ feed, active, enabled, selected, read, onRead }: {
  feed: Feed; active: boolean; enabled: boolean; selected: number | null; read: Set<number>; onRead: (id: number) => void;
}) {
  const [ids, setIds] = useState<number[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
    } catch { if (version === generation.current) setError(true); }
    finally { if (version === generation.current) setBusy(false); }
  }
  useEffect(() => {
    if (enabled && !loaded) void load(true);
    // A feed is loaded once on its first visit, then only on explicit refresh.
  }, [enabled]);
  useLayoutEffect(() => { if (active && scrolling.current) scrolling.current.scrollTop = scrollTop.current; }, [active]);

  async function retryItem(id: number) {
    const version = generation.current;
    const [result] = await getItems([id]);
    if (version === generation.current) setItems(previous => previous.map(item => item.id === id ? result : item));
  }

  return <section className="feed-panel" hidden={!active} aria-label={`${feed} stories`}>
    <div className="feed-heading">
      <div><span className="eyebrow">YOUR DAILY CURIOSITY</span><h1>{feedInfo[feed].title}</h1><p>{feedInfo[feed].description}</p></div>
      <button className={`icon-button refresh ${busy ? 'is-loading' : ''}`} aria-label="Refresh stories" title="Refresh stories" disabled={busy} onClick={() => { clearCache(); void load(true); }}><Icon name="refresh" /></button>
    </div>
    <div className="list-caption"><span>STORIES</span><span>{busy ? 'Updating…' : 'A little less noise.'}</span></div>
    <div className="feed-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {error && <Failure retry={() => void load(!loaded)}>Couldn’t load the stories. Your connection may need a moment.</Failure>}
      {!loaded && busy && <Skeleton rows={8} />}
      {loaded && !ids.length && <div className="small-empty">No stories here just yet. Check back soon.</div>}
      <StoryList items={items} selected={selected} read={read} onRead={onRead} onRetry={id => void retryItem(id)}
        href={id => `/item?id=${id}&feed=${feed}`} fallbackSource={feed === 'ask' ? 'Ask HN' : 'Hacker News'} />
      {loaded && items.length < ids.length && <div className="load-more-wrap"><button className="secondary-button" disabled={busy} onClick={() => void load()}>{busy ? 'Loading stories…' : 'Load more stories'} <span aria-hidden="true">↓</span></button><span className="load-caption">{items.length} of {ids.length} stories</span></div>}
      {loaded && items.length > 0 && items.length >= ids.length && <p className="end-note">You’re all caught up. A good time for a little break.</p>}
    </div>
    <footer className="feed-footer"><span className="live-dot" />Powered by the Hacker News community<ExternalLink href="https://news.ycombinator.com"><span className="sr-only">Visit Hacker News</span><Icon name="arrow" size={14} /></ExternalLink></footer>
  </section>;
}
