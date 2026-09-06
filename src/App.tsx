import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { feeds, type Feed } from './api';
import FeedPanel from './components/FeedPanel';
import Discussion, { EmptyDiscussion } from './components/Discussion';
import { Icon } from './components/ui';
import { readStorage, useReadStories, writeStorage } from './storage';

type Theme = 'system' | 'light' | 'dark';
export default function App() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const feed = feeds.includes(query.get('feed') as Feed) ? query.get('feed') as Feed : 'top';
  const rawId = query.get('id');
  const selected = location.pathname === '/item' && rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const invalid = location.pathname !== '/' && (location.pathname !== '/item' || !selected);
  const [visited, setVisited] = useState<Feed[]>([feed]);
  const [opened, setOpened] = useState<number[]>(selected ? [selected] : []);
  const { read, markRead } = useReadStories();
  const previousSelection = useRef(selected);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readStorage('hn-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  useEffect(() => {
    setVisited(previous => previous.includes(feed) ? previous : [...previous, feed]);
  }, [feed]);
  useEffect(() => {
    if (selected) {
      setOpened(previous => [...previous.filter(id => id !== selected), selected].slice(-10));
      markRead(selected);
    } else document.title = 'HN Reader — A little less noise.';
  }, [selected, markRead]);
  useLayoutEffect(() => {
    if (!selected && previousSelection.current) {
      document.querySelector<HTMLAnchorElement>(`.feed-panel:not([hidden]) [data-story-id="${previousSelection.current}"] h2 a`)?.focus({ preventScroll: true });
    }
    previousSelection.current = selected;
  }, [selected]);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    writeStorage('hn-theme', theme);
  }, [theme]);

  return <div className="app-shell">
    <a className="skip-link" href="#reader">Skip to reader</a>
    <header className="app-header"><Link className="brand" to="/" aria-label="HN Reader home"><span className="brand-mark">Y</span><span>hn<span className="brand-light">reader</span><span className="brand-period">.</span></span></Link><span className="header-tagline">A quieter corner of Hacker News.</span><div className="theme-control"><Icon name="sun" size={16} /><select aria-label="Color theme" value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></header>
    <nav className="feed-nav" aria-label="Story feeds"><div className="feed-tabs">{feeds.map(value => <Link key={value} to={`/?feed=${value}`} aria-current={value === feed ? 'page' : undefined}><span>{value === 'top' && <span className="tab-star" aria-hidden="true">✳</span>}{value[0].toUpperCase() + value.slice(1)}</span>{value === 'ask' && <span className="nav-suffix">HN</span>}{value === 'show' && <span className="nav-suffix">HN</span>}</Link>)}</div><span className="nav-note">Stay curious.</span></nav>
    <main id="reader" tabIndex={-1} className={`reader ${selected || invalid ? 'has-selection' : ''}`}>
      <div className="feed-column">{feeds.map(value => <FeedPanel key={value} feed={value} active={value === feed} enabled={visited.includes(value)} selected={selected} read={read} onRead={markRead} />)}</div>
      <div className="discussion-column">{invalid ? <div className="invalid-route"><h1>Nothing to read here.</h1><p>This link doesn’t point to a valid story.</p><Link to="/">Back to the front page</Link></div> : <>{!selected && <EmptyDiscussion />}{opened.map(id => <Discussion key={id} id={id} feed={feed} active={id === selected} />)}</>}</div>
    </main>
  </div>;
}
