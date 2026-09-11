import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { feeds, type Feed } from './api';
import FeedPanel from './components/FeedPanel';
import SearchPanel from './components/SearchPanel';
import Discussion, { EmptyDiscussion } from './components/Discussion';
import { Icon } from './components/ui';
import { readStorage, useReadStories, writeStorage } from './storage';

type Theme = 'system' | 'light' | 'dark';
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const feed = feeds.includes(query.get('feed') as Feed) ? query.get('feed') as Feed : 'top';
  const search = (query.get('q') ?? '').trim().slice(0, 200);
  const rawId = query.get('id');
  const selected = location.pathname === '/item' && rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const invalid = location.pathname !== '/' && (location.pathname !== '/item' || !selected);
  const backTo = search ? `/?q=${encodeURIComponent(search)}` : `/?feed=${feed}`;
  const [visited, setVisited] = useState<Feed[]>(search ? [] : [feed]);
  const [opened, setOpened] = useState<number[]>(selected ? [selected] : []);
  const { read, markRead } = useReadStories();
  const previousSelection = useRef(selected);
  const searchInput = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readStorage('hn-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  useEffect(() => {
    if (!search) setVisited(previous => previous.includes(feed) ? previous : [...previous, feed]);
  }, [feed, search]);
  useEffect(() => {
    if (selected) {
      setOpened(previous => [...previous.filter(id => id !== selected), selected].slice(-10));
      markRead(selected);
    } else document.title = search ? `${search} — HN Reader` : 'HN Reader — A little less noise.';
  }, [selected, search, markRead]);
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

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = searchInput.current?.value.trim() ?? '';
    void navigate(value ? `/?q=${encodeURIComponent(value)}` : `/?feed=${feed}`);
  }

  return <div className="app-shell">
    <a className="skip-link" href="#reader">Skip to reader</a>
    <header className="app-header"><Link className="brand" to="/" aria-label="HN Reader home"><span className="brand-mark">Y</span><span>hn<span className="brand-light">reader</span><span className="brand-period">.</span></span></Link><span className="header-tagline">A quieter corner of Hacker News.</span><div className="theme-control"><Icon name="sun" size={16} /><select aria-label="Color theme" value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></header>
    <nav className="feed-nav" aria-label="Story feeds"><div className="feed-tabs">{feeds.map(value => <Link key={value} to={`/?feed=${value}`} aria-current={!search && value === feed ? 'page' : undefined}><span>{value === 'top' && <span className="tab-star" aria-hidden="true">✳</span>}{value[0].toUpperCase() + value.slice(1)}</span>{value === 'ask' && <span className="nav-suffix">HN</span>}{value === 'show' && <span className="nav-suffix">HN</span>}</Link>)}</div>
      <form className="search-form" role="search" onSubmit={submitSearch}><Icon name="search" size={14} /><input key={search} ref={searchInput} type="search" name="q" defaultValue={search} maxLength={200} placeholder="Search stories" aria-label="Search Hacker News stories" aria-keyshortcuts="/" />{search && <button type="button" className="text-button clear-search" onClick={() => void navigate(`/?feed=${feed}`)}>Clear</button>}</form></nav>
    <main id="reader" tabIndex={-1} className={`reader ${selected || invalid ? 'has-selection' : ''}`}>
      <div className="feed-column">
        {feeds.map(value => <FeedPanel key={value} feed={value} active={!search && value === feed} enabled={!search && visited.includes(value)} selected={selected} read={read} onRead={markRead} />)}
        {search && <SearchPanel key={search} query={search} active selected={selected} read={read} onRead={markRead} />}
      </div>
      <div className="discussion-column">{invalid ? <div className="invalid-route"><h1>Nothing to read here.</h1><p>This link doesn’t point to a valid story.</p><Link to="/">Back to the front page</Link></div> : <>{!selected && <EmptyDiscussion />}{opened.map(id => <Discussion key={id} id={id} backTo={backTo} active={id === selected} />)}</>}</div>
    </main>
  </div>;
}
