import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { getComments, getItem, type Comment, type HNItem } from '../api';
import { domain, hnUrl, plainTitle, safeUrl, shareUrl } from '../format';
import { FLAT_DEPTH, indexThread, opensByDefault, ThreadProvider, useThread } from '../thread';
import { useViewSettings } from '../settings';
import { Author, ExternalLink, Failure, Favicon, Icon, OpenIn, SaveButton, ShareButton, Skeleton, Time } from './ui';
import RichText from './RichText';

// Item ids are handed out in order, so they sort by age.
type Order = 'hn' | 'newest' | 'oldest';
const orders: [Order, string][] = [['hn', 'HN order'], ['newest', 'Newest first'], ['oldest', 'Oldest first']];
const BATCH = 20;

// The whole thread arrives in one response, so a long one is revealed a batch
// at a time to keep the first render short.
function CommentBatch({ comments, depth = 0 }: { comments: Comment[]; depth?: number }) {
  const [shown, setShown] = useState(BATCH);
  return <div className={depth ? 'replies' : 'comments-list'}>
    {comments.slice(0, shown).map(comment => <CommentView key={comment.id} comment={comment} depth={depth} />)}
    {shown < comments.length && <button className="text-button more-comments" onClick={() => setShown(shown + BATCH)}>Show more {depth ? 'replies' : 'comments'} <span aria-hidden="true">↓</span></button>}
  </div>;
}

function CommentView({ comment, depth }: { comment: Comment; depth: number }) {
  const { index, author } = useThread();
  const { autoExpand } = useViewSettings();
  const entry = index.get(comment.id);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(() => autoExpand && opensByDefault(entry));
  const replies = comment.kids;
  // What a collapsed comment hides is its whole subtree, not the replies
  // directly under it, so that is the number worth reporting.
  const total = entry?.total ?? replies.length;
  return <article className={`comment ${depth >= FLAT_DEPTH ? 'flat-thread' : ''}`} data-comment-id={comment.id} tabIndex={-1}>
    <div className="comment-header">
      <button className="collapse-target" aria-label={`${collapsed ? 'Expand' : 'Collapse'} comment by ${comment.by ?? 'unknown author'}`} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)} />
      <span className="collapse-mark" aria-hidden="true">{collapsed ? '+' : '−'}</span>
      <span className="avatar" aria-hidden="true">{comment.removed ? '–' : (comment.by?.[0] ?? '?').toUpperCase()}</span>
      <span className="comment-author">{comment.removed ? 'Removed comment' : <Author name={comment.by} />}</span>
      {/* The header makes everything but the collapse target click-through, so
          this says what it means in text rather than in a tooltip. */}
      {comment.by && comment.by === author && <span className="op-badge">OP<span className="sr-only"> — the author of this story</span></span>}
      <Time value={comment.time} />
    </div>
    {collapsed && <span className="collapsed-note">Comment collapsed{total ? ` · ${total} ${total === 1 ? 'reply' : 'replies'}` : ''}</span>}
    <div hidden={collapsed}>
      {comment.removed ? <p className="missing-comment">This comment is no longer available.</p> : <RichText text={comment.text ?? ''} />}
      {replies.length > 0 && <button className="reply-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><span className={expanded ? 'rotated' : ''}><Icon name="chevron" size={12} /></span>{expanded ? 'Hide replies' : `Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}</button>}
      {expanded && <CommentBatch comments={replies} depth={depth + 1} />}
    </div>
  </article>;
}

export default function Discussion({ id, backTo, active, articleTo, showArticle, saved, onToggleSaved }: {
  id: number; backTo: string; active: boolean; articleTo: string; showArticle: boolean;
  saved: boolean; onToggleSaved: () => void;
}) {
  const [item, setItem] = useState<HNItem | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [order, setOrder] = useState<Order>('hn');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [commentsAttempt, setCommentsAttempt] = useState(0);
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
    let current = true;
    setComments(null); setCommentsError(false);
    void getComments(id).then(result => { if (current) setComments(result); }).catch(() => { if (current) setCommentsError(true); });
    return () => { current = false; };
  }, [id, commentsAttempt]);
  useEffect(() => {
    if (!active || busy) return;
    document.title = `${item ? plainTitle(item.title) : 'Story unavailable'} — HN Reader`;
    // The heading appears only once the item has loaded, so focus reaches it
    // after the story opened. It is taken from the row the story was opened
    // from and from nowhere else: the list stays beside the story, so focus
    // anywhere further along it belongs to the reader stepping on with j or k.
    const focused = document.activeElement;
    const ownRow = focused?.closest('[data-story-id]')?.getAttribute('data-story-id') === String(id);
    if (ownRow || !focused || focused === document.body) heading.current?.focus({ preventScroll: true });
  }, [active, busy, item, id]);
  const url = safeUrl(item?.url);
  const threads = useMemo(() => {
    if (!comments || order === 'hn') return comments ?? [];
    return [...comments].sort((a, b) => order === 'newest' ? b.id - a.id : a.id - b.id);
  }, [comments, order]);
  // Built from the thread as it arrived, so re-sorting the roots does not
  // rebuild what is true of every comment regardless of order.
  const thread = useMemo(() => ({ index: indexThread(comments ?? []), author: item?.by }), [comments, item?.by]);
  const unavailable = !item || item.deleted || item.dead;
  const supported = !item?.type || ['story', 'job'].includes(item.type);
  return <section className="discussion-panel" hidden={!active} aria-label="Discussion">
    <div className="discussion-toolbar">
      <Link to={backTo} className="back-link" aria-label="Back to stories"><Icon name="back" size={16} /><span>Back to stories</span></Link>
      <div className="pane-tabs">
        <Link to={articleTo} className="pane-tab"><Icon name="reader" size={14} />Article</Link>
        <span className="pane-tab" aria-current="page"><Icon name="comment" size={14} />Comments</span>
      </div>
      <div className="discussion-actions">
        <ShareButton url={shareUrl(id)} title={plainTitle(item?.title)} />
        <SaveButton saved={saved} onToggle={onToggleSaved} title={plainTitle(item?.title)} className="with-label" />
      </div>
    </div>
    <div className="discussion-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {busy ? <Skeleton rows={5} /> : error ? <Failure retry={() => setAttempt(attempt + 1)}>Couldn’t load this discussion.</Failure> : unavailable ? <div className="unavailable"><h2 tabIndex={-1} ref={heading}>Story unavailable</h2><p>This story may have been removed.</p><ExternalLink href={hnUrl(id)}>Check on Hacker News <Icon name="arrow" size={14} /></ExternalLink></div> : <div className="discussion-inner">
        {/* The reading pane carries the full title, so the conversation keeps
            only as much of the story as a header needs when both are open. */}
        <header className={`article-heading ${showArticle ? 'is-compact' : ''}`}>
          {!showArticle && <div className="eyebrow article-source">{url && <Favicon url={url} />}{url ? domain(url) : 'FROM THE COMMUNITY'}</div>}
          <h2 ref={heading} tabIndex={-1}>{plainTitle(item.title)}</h2>
          <div className="article-meta"><span className="score"><span aria-hidden="true">▴</span> {item.score ?? 0} points</span><span className="meta-dot">·</span><span>by <Author name={item.by} /></span><span className="meta-dot">·</span><Time value={item.time} /><span className="meta-dot">·</span><span>{item.descendants ?? 0} comments</span></div>
          {!showArticle && <div className="article-links">{url && <Link to={articleTo} className="article-link">Read <Icon name="reader" size={16} /></Link>}<OpenIn url={url} id={id} title={plainTitle(item.title)} /></div>}
        </header>
        {item.text && <div className="story-body"><RichText text={item.text} /></div>}
        {!supported ? <div className="small-empty"><p>{item.type === 'comment' ? 'This link points to a comment rather than a story, and the thread it belongs to lives on Hacker News.' : 'Continue reading this item on Hacker News.'}</p><ExternalLink href={hnUrl(id)}>Open on HN <Icon name="arrow" size={14} /></ExternalLink></div> : <><div className="discussion-label"><h3><Icon name="comment" size={18} />The conversation <span>{item.descendants ?? 0}</span></h3><label className="sort-control">Sort<select aria-label="Comment order" value={order} onChange={event => setOrder(event.target.value as Order)}>{orders.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></div>{commentsError ? <Failure retry={() => setCommentsAttempt(commentsAttempt + 1)}>Couldn’t load the comments. A story posted in the last few minutes may not be searchable yet.</Failure> : !comments ? <Skeleton rows={3} /> : threads.length ? <ThreadProvider value={thread}><CommentBatch key={order} comments={threads} /></ThreadProvider> : <div className="small-empty"><Icon name="comment" size={28} /><p>A little quiet here, for now.</p><ExternalLink href={hnUrl(id)}>Join the conversation on HN <Icon name="arrow" size={14} /></ExternalLink></div>}</>}
        <div className="discussion-end"><span>That’s the conversation, at your pace.</span><ExternalLink href={hnUrl(id)}>Reply on Hacker News <Icon name="arrow" size={13} /></ExternalLink></div>
      </div>}
    </div>
  </section>;
}

export function EmptyDiscussion() {
  return <section className="empty-discussion" aria-label="No story selected"><span className="empty-overline">THE INTERNET IS INTERESTING.</span><div className="reading-mark"><Icon name="book" size={48} /><span className="reading-spark">✳</span></div><h2>Follow your curiosity.</h2><p>Pick a story on the left.<br />There’s a good conversation waiting.</p><div className="empty-rule" /><span className="empty-footnote">A little less noise. A little more perspective.</span><div className="empty-bottom">GOOD STORIES. THOUGHTFUL CONVERSATIONS.</div></section>;
}
