import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { getItem, getItems, type Feed, type HNItem, type ItemResult } from '../api';
import { domain, hnUrl, plainTitle, safeUrl } from '../format';
import { Author, ExternalLink, Failure, Icon, RichText, Skeleton, Time } from './ui';

function CommentBatch({ ids, depth = 0 }: { ids: number[]; depth?: number }) {
  const [items, setItems] = useState<ItemResult[]>([]);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let current = true;
    void getItems(ids.slice(0, 20)).then(result => { if (current) { setItems(result); setBusy(false); } });
    return () => { current = false; };
  }, [ids]);
  async function more() {
    setBusy(true);
    const result = await getItems(ids.slice(items.length, items.length + 20));
    setItems(previous => [...previous, ...result]); setBusy(false);
  }
  async function retry(id: number) {
    const [result] = await getItems([id]);
    setItems(previous => previous.map(item => item.id === id ? result : item));
  }
  return <div className={depth ? 'replies' : 'comments-list'}>
    {items.map(result => result.error ? <Failure key={result.id} retry={() => void retry(result.id)}>This comment couldn’t load.</Failure> : <Comment key={result.id} item={result.item} depth={depth} />)}
    {busy && <Skeleton rows={items.length ? 1 : 3} />}
    {!busy && items.length < ids.length && <button className="text-button more-comments" onClick={() => void more()}>Load more {depth ? 'replies' : 'comments'} <span aria-hidden="true">↓</span></button>}
  </div>;
}

function Comment({ item, depth }: { item: HNItem | null; depth: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  if (!item) return <div className="missing-comment">Comment unavailable</div>;
  const removed = item.deleted || item.dead;
  const replies = item.kids ?? [];
  return <article className={`comment ${depth >= 3 ? 'flat-thread' : ''}`}>
    <div className="comment-header"><span className="avatar" aria-hidden="true">{removed ? '–' : (item.by?.[0] ?? '?').toUpperCase()}</span><span className="comment-author">{removed ? 'Removed comment' : <Author name={item.by} />}</span><Time value={item.time} /><button className="collapse-button" aria-label={`${collapsed ? 'Expand' : 'Collapse'} comment by ${item.by ?? 'unknown author'}`} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '+' : '−'}</button></div>
    {collapsed && <span className="collapsed-note">Comment collapsed{replies.length ? ` · ${replies.length} direct ${replies.length === 1 ? 'reply' : 'replies'}` : ''}</span>}
    <div hidden={collapsed}>
      {removed ? <p className="missing-comment">This comment is no longer available.</p> : <RichText text={item.text ?? ''} />}
      {replies.length > 0 && <button className="reply-toggle" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); setRepliesLoaded(true); }}><span className={expanded ? 'rotated' : ''}><Icon name="chevron" size={12} /></span>{expanded ? 'Hide replies' : `Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}</button>}
      {repliesLoaded && <div hidden={!expanded}><CommentBatch ids={replies} depth={depth + 1} /></div>}
    </div>
  </article>;
}

export default function Discussion({ id, feed, active }: { id: number; feed: Feed; active: boolean }) {
  const [item, setItem] = useState<HNItem | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const scrolling = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  useLayoutEffect(() => { if (active && scrolling.current) scrolling.current.scrollTop = scrollTop.current; }, [active]);
  useEffect(() => {
    let current = true;
    setBusy(true); setError(false);
    void getItem(id).then(result => { if (current) setItem(result); }).catch(() => { if (current) setError(true); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [id, attempt]);
  useEffect(() => {
    if (active && !busy) {
      document.title = `${item ? plainTitle(item.title) : 'Story unavailable'} — HN Reader`;
      heading.current?.focus({ preventScroll: true });
    }
  }, [active, busy, item]);
  const url = safeUrl(item?.url);
  const unavailable = !item || item.deleted || item.dead;
  const supported = !item?.type || ['story', 'job'].includes(item.type);
  return <section className="discussion-panel" hidden={!active} aria-label="Discussion">
    <div className="discussion-toolbar"><Link to={`/?feed=${feed}`} className="back-link"><Icon name="back" size={16} /><span>Back to stories</span></Link><ExternalLink href={hnUrl(id)}>View on HN <Icon name="arrow" size={13} /></ExternalLink></div>
    <div className="discussion-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {busy ? <Skeleton rows={5} /> : error ? <Failure retry={() => setAttempt(attempt + 1)}>Couldn’t load this discussion.</Failure> : unavailable ? <div className="unavailable"><h2 tabIndex={-1} ref={heading}>Story unavailable</h2><p>This story may have been removed.</p><ExternalLink href={hnUrl(id)}>Check on Hacker News <Icon name="arrow" size={14} /></ExternalLink></div> : <div className="discussion-inner">
        <header className="article-heading"><div className="eyebrow">{url ? domain(url) : 'FROM THE COMMUNITY'}</div><h2 ref={heading} tabIndex={-1}>{plainTitle(item.title)}</h2><div className="article-meta"><span className="score">▴ {item.score ?? 0} points</span><span>by <Author name={item.by} /></span><Time value={item.time} /></div>{url && <ExternalLink href={url} className="article-link">Read original <Icon name="arrow" size={16} /></ExternalLink>}</header>
        {item.text && <div className="story-body"><RichText text={item.text} /></div>}
        {!supported ? <div className="small-empty"><p>Continue reading this item on Hacker News.</p><ExternalLink href={hnUrl(id)}>Open on HN <Icon name="arrow" size={14} /></ExternalLink></div> : <><div className="discussion-label"><h3><Icon name="comment" size={18} />The conversation <span>{item.descendants ?? 0}</span></h3><span>HN order</span></div>{item.kids?.length ? <CommentBatch ids={item.kids} /> : <div className="small-empty"><Icon name="comment" size={28} /><p>A little quiet here, for now.</p><ExternalLink href={hnUrl(id)}>Join the conversation on HN <Icon name="arrow" size={14} /></ExternalLink></div>}</>}
        <div className="discussion-end"><span>That’s the conversation, at your pace.</span><ExternalLink href={hnUrl(id)}>Reply on Hacker News <Icon name="arrow" size={13} /></ExternalLink></div>
      </div>}
    </div>
  </section>;
}

export function EmptyDiscussion() {
  return <section className="empty-discussion" aria-label="No story selected"><span className="empty-overline">THE INTERNET IS INTERESTING.</span><div className="reading-mark"><Icon name="book" size={48} /><span className="reading-spark">✳</span></div><h2>Follow your curiosity.</h2><p>Pick a story on the left.<br />There’s a good conversation waiting.</p><div className="empty-rule" /><span className="empty-footnote">A little less noise. A little more perspective.</span><div className="empty-bottom">GOOD STORIES. THOUGHTFUL CONVERSATIONS.</div></section>;
}
