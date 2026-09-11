import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Link } from 'react-router';
import { getArticle, getItem, type HNItem } from '../api';
import { archiveUrl, domain, plainTitle, readingTime, safeUrl, sanitizeArticle } from '../format';
import { readStorage, writeStorage } from '../storage';
import { ExternalLink, Failure, Favicon, Icon, OpenIn, Skeleton } from './ui';

type Mode = 'reader' | 'embed';

function Reader({ url }: { url: string }) {
  const [html, setHtml] = useState('');
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true); setError('');
    void getArticle(url)
      .then(article => {
        if (!current) return;
        setHtml(sanitizeArticle(marked.parse(article.markdown, { async: false })));
        setMinutes(readingTime(article.markdown));
      })
      .catch((cause: Error) => { if (current) setError(cause.message); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [url, attempt]);

  if (busy) return <Skeleton rows={6} />;
  if (error) return <Failure retry={() => setAttempt(attempt + 1)}>{error}</Failure>;
  return <>
    <div className="article-stats">{minutes}<span className="meta-dot">·</span>Reader view</div>
    <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
  </>;
}

export default function Article({ id, active, shown, backTo, commentsTo }: {
  id: number; active: boolean; shown: boolean; backTo: string; commentsTo: string;
}) {
  const [item, setItem] = useState<HNItem | null>(null);
  const [busy, setBusy] = useState(true);
  // The pane stays mounted to keep its scroll position and its extracted text,
  // so the extraction and the embed wait for the pane to be on screen once.
  const [revealed, setRevealed] = useState(false);
  if (!revealed && active && shown) setRevealed(true);
  const [mode, setMode] = useState<Mode>(() => readStorage('hn-article-mode') === 'embed' ? 'embed' : 'reader');
  const scrolling = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);
  useLayoutEffect(() => { if (active && scrolling.current) scrolling.current.scrollTop = scrollTop.current; }, [active]);
  useEffect(() => {
    if (!revealed) return;
    let current = true;
    void getItem(id).then(result => { if (current) setItem(result); }).catch(() => { /* The discussion pane reports item failures. */ })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [id, revealed]);
  function choose(next: Mode) {
    setMode(next);
    writeStorage('hn-article-mode', next);
  }

  const url = safeUrl(item?.url);
  const title = plainTitle(item?.title);
  if (!revealed) return <section className="article-panel" hidden aria-label="Article" />;
  return <section className="article-panel" hidden={!active} aria-label="Article">
    <div className="article-toolbar">
      <Link to={backTo} className="back-link pane-back" aria-label="Back to stories"><Icon name="back" size={16} /><span>Back to stories</span></Link>
      <div className="pane-tabs">
        <span className="pane-tab" aria-current="page"><Icon name="reader" size={14} />Article</span>
        <Link to={commentsTo} className="pane-tab"><Icon name="comment" size={14} />Comments</Link>
      </div>
      <div className="article-actions">
        {url && <div className="mode-switch" role="group" aria-label="Article view">
          <button type="button" aria-pressed={mode === 'reader'} onClick={() => choose('reader')}><Icon name="reader" size={13} /><span className="mode-label">Reader</span></button>
          <button type="button" aria-pressed={mode === 'embed'} onClick={() => choose('embed')}><Icon name="embed" size={13} /><span className="mode-label">Embed</span></button>
        </div>}
        <OpenIn url={url} id={id} title={title} />
      </div>
    </div>
    <div className="article-scroll" ref={scrolling} onScroll={event => { if (active) scrollTop.current = event.currentTarget.scrollTop; }}>
      {busy ? <Skeleton rows={6} /> : !url ? <div className="small-empty">
        <Icon name="comment" size={28} />
        <p>{item ? 'This story has no link of its own — it lives in the conversation.' : 'This story is unavailable.'}</p>
        <Link to={commentsTo}>Read the discussion</Link>
      </div> : <div className="article-inner">
        <header className="article-heading">
          <div className="eyebrow article-source"><Favicon url={url} />{domain(url)}</div>
          <h2>{title}</h2>
        </header>
        {mode === 'reader' ? <Reader url={url} /> : <div className="article-embed">
          <iframe src={url} title={`${title} (embedded)`} loading="lazy" referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" />
          <p className="embed-note">Blank? Many sites refuse to be embedded. <ExternalLink href={url}>Open original</ExternalLink> or <ExternalLink href={archiveUrl(url)}>read it on archive.is</ExternalLink>.</p>
        </div>}
      </div>}
    </div>
  </section>;
}
