import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getItems, type ItemResult } from '../api';
import { FeedFooter, Icon, Skeleton } from './ui';
import { useViewSettings } from '../settings';
import StoryList from './StoryList';

export default function SavedPanel({ active, selected, saved, read, onRead, onToggleSaved, hrefSuffix }: {
  active: boolean; selected: number | null; saved: Set<number>; read: Set<number>;
  onRead: (id: number) => void; onToggleSaved: (id: number) => void; hrefSuffix: string;
}) {
  const settings = useViewSettings();
  const [items, setItems] = useState<ItemResult[]>([]);
  const [busy, setBusy] = useState(true);
  const scrolling = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  // Most recently saved first.
  const ids = [...saved].reverse();
  const key = ids.join(',');

  useEffect(() => {
    let current = true;
    setBusy(true);
    void getItems(key ? key.split(',').map(Number) : []).then(result => { if (current) { setItems(result); setBusy(false); } });
    return () => { current = false; };
  }, [key]);
  useLayoutEffect(() => { if (active && scrolling.current) scrolling.current.scrollTop = scrollTop.current; }, [active]);

  async function retryItem(id: number) {
    const [result] = await getItems([id]);
    setItems(previous => previous.map(item => item.id === id ? result : item));
  }

  return <section className="feed-panel" hidden={!active} aria-label="Saved stories">
    {settings.heading && <div className="feed-heading">
      <div><span className="eyebrow">YOUR SHELF</span><h1>Saved for later</h1><p>Stories you starred, waiting for a quieter moment.</p></div>
    </div>}
    <div className="list-caption"><span>SAVED</span><span>{ids.length} {ids.length === 1 ? 'story' : 'stories'}</span></div>
    <div className="feed-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {busy && ids.length > 0 && !items.length && <Skeleton rows={4} />}
      {!ids.length && <div className="small-empty"><Icon name="star" size={28} /><p>Nothing saved yet. Press <kbd>s</kbd> on a story, or use the star in the list.</p></div>}
      <StoryList items={items} selected={selected} read={read} onRead={onRead} saved={saved} onToggleSaved={onToggleSaved}
        onRetry={id => void retryItem(id)} href={id => `/item?id=${id}&feed=saved${hrefSuffix}`} fallbackSource="Hacker News" />
    </div>
    <FeedFooter>Kept in this browser only</FeedFooter>
  </section>;
}
