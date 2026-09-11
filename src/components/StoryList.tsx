import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { prefetchStory, type ItemResult } from '../api';
import { domain, hnUrl, plainTitle, safeUrl } from '../format';
import { Author, ExternalLink, Failure, Favicon, Icon, SaveButton, Time } from './ui';

export default function StoryList({ items, selected, read, onRead, saved, onToggleSaved, href, fallbackSource, onRetry }: {
  items: ItemResult[];
  selected: number | null;
  read: Set<number>;
  onRead: (id: number) => void;
  saved: Set<number>;
  onToggleSaved: (id: number) => void;
  href: (id: number) => string;
  fallbackSource: string;
  onRetry?: (id: number) => void;
}) {
  // A short rest before fetching, so sweeping the pointer down the list does not
  // queue a request for every row it crosses.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cancel = () => clearTimeout(timer.current);
  useEffect(() => cancel, []);
  function warm(id: number) {
    cancel();
    timer.current = setTimeout(() => void prefetchStory(id), 120);
  }
  return <ol className="story-list">
    {items.map(({ id, item, error: failed }, index) => {
      const rank = <span className="rank">{String(index + 1).padStart(2, '0')}</span>;
      if (failed) return <li key={id} className="story-failure">{rank}<Failure retry={onRetry && (() => onRetry(id))}>This story couldn’t load.</Failure></li>;
      if (!item || item.deleted || item.dead) return <li className="story-unavailable" key={id}>{rank}<span>Story unavailable</span></li>;
      const unsupported = item.type && !['story', 'job'].includes(item.type);
      const url = safeUrl(item.url);
      return <li key={id} data-story-id={id} className={`story-row ${selected === id ? 'selected' : ''} ${read.has(id) ? 'is-read' : ''}`}
        onMouseEnter={() => warm(id)} onMouseLeave={cancel} onFocus={() => warm(id)} onBlur={cancel}>
        <Favicon url={url} fallback={fallbackSource} className="story-favicon" />
        <div className="story-content">
          <div className="story-domain">{rank}{read.has(id) && <span className="read-dot" title="Read"><span className="sr-only">Read</span></span>}{url ? <ExternalLink href={url}>{domain(url)} <Icon name="arrow" size={11} /></ExternalLink> : <span>{fallbackSource}</span>}</div>
          <h2>{unsupported ? <ExternalLink href={hnUrl(id)}>{plainTitle(item.title)}</ExternalLink> : <Link to={href(id)} onClick={() => onRead(id)} aria-current={selected === id ? 'true' : undefined}>{plainTitle(item.title)}</Link>}</h2>
          <div className="story-meta"><span className="score"><span aria-hidden="true">▴</span> {item.score ?? 0}</span><Link className="comment-count" to={href(id)} onClick={() => onRead(id)} aria-label={`${item.descendants ?? 0} comments on ${plainTitle(item.title)}`}><Icon name="comment" size={14} />{item.descendants ?? 0}</Link><span className="meta-dot">·</span><Author name={item.by} /><span className="meta-dot">·</span><Time value={item.time} /></div>
        </div>
        <SaveButton saved={saved.has(id)} onToggle={() => onToggleSaved(id)} title={plainTitle(item.title)} className="story-star" />
      </li>;
    })}
  </ol>;
}
