import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { feeds, type Feed } from './api';
import Article from './components/Article';
import FeedPanel from './components/FeedPanel';
import SavedPanel from './components/SavedPanel';
import SearchPanel from './components/SearchPanel';
import Shortcuts from './components/Shortcuts';
import Discussion, { EmptyDiscussion } from './components/Discussion';
import { Icon } from './components/ui';
import { useKeyboardShortcuts } from './keyboard';
import { readStorage, useReadStories, useSavedStories, writeStorage } from './storage';

type Theme = 'system' | 'light' | 'dark';
type View = Feed | 'saved';
const views: View[] = [...feeds, 'saved'];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const view = views.includes(query.get('feed') as View) ? query.get('feed') as View : 'top';
  const search = (query.get('q') ?? '').trim().slice(0, 200);
  const rawId = query.get('id');
  const selected = location.pathname === '/item' && rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const invalid = location.pathname !== '/' && (location.pathname !== '/item' || !selected);
  const showArticle = query.get('article') === '1';
  const suffix = showArticle ? '&article=1' : '';
  const backTo = search ? `/?q=${encodeURIComponent(search)}${suffix}` : `/?feed=${view}${suffix}`;
  const [visited, setVisited] = useState<Feed[]>(search || view === 'saved' ? [] : [view]);
  const [opened, setOpened] = useState<number[]>(selected ? [selected] : []);
  const { read, markRead } = useReadStories();
  const { saved, toggleSaved } = useSavedStories();
  const [hideRead, setHideRead] = useState(() => readStorage('hn-hide-read') === '1');
  const [helpOpen, setHelpOpen] = useState(false);
  const previousSelection = useRef(selected);
  const searchInput = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readStorage('hn-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });

  // The article pane is one bit in the URL, so a shared link opens the same panes.
  function paneTo(on: boolean) {
    const next = new URLSearchParams(location.search);
    if (on) next.set('article', '1'); else next.delete('article');
    return `${location.pathname}?${next.toString()}`;
  }
  const articleTo = paneTo(true);
  const commentsTo = paneTo(false);
  const toggleArticle = useCallback(() => {
    const next = new URLSearchParams(location.search);
    if (showArticle) next.delete('article'); else next.set('article', '1');
    void navigate(`${location.pathname}?${next.toString()}`);
  }, [location.pathname, location.search, showArticle, navigate]);
  const openHelp = useCallback(() => setHelpOpen(true), []);

  useKeyboardShortcuts({ selected, backTo, search: searchInput, helpOpen, onHelp: openHelp, onToggleArticle: toggleArticle, onToggleSaved: toggleSaved });
  useEffect(() => {
    if (!search && view !== 'saved') setVisited(previous => previous.includes(view) ? previous : [...previous, view]);
  }, [view, search]);
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
  function changeHideRead(on: boolean) {
    setHideRead(on);
    writeStorage('hn-hide-read', on ? '1' : '');
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = searchInput.current?.value.trim() ?? '';
    void navigate(value ? `/?q=${encodeURIComponent(value)}${suffix}` : `/?feed=${view}${suffix}`);
  }

  const listProps = { selected, read, onRead: markRead, saved, onToggleSaved: toggleSaved, hrefSuffix: suffix };
  return <div className="app-shell">
    <a className="skip-link" href="#reader">Skip to reader</a>
    <header className="app-header"><Link className="brand" to="/" aria-label="HN Reader home"><span className="brand-mark">Y</span><span>hn<span className="brand-light">reader</span><span className="brand-period">.</span></span></Link><span className="header-tagline">A quieter corner of Hacker News.</span><div className="theme-control"><button type="button" className="icon-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick={openHelp}><Icon name="help" size={16} /></button><Icon name="sun" size={16} /><select aria-label="Color theme" value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div></header>
    <nav className="feed-nav" aria-label="Story feeds"><div className="feed-tabs">{feeds.map(value => <Link key={value} to={`/?feed=${value}${suffix}`} aria-current={!search && value === view ? 'page' : undefined}><span>{value === 'top' && <span className="tab-star" aria-hidden="true">✳</span>}{value[0].toUpperCase() + value.slice(1)}</span>{value === 'ask' && <span className="nav-suffix">HN</span>}{value === 'show' && <span className="nav-suffix">HN</span>}</Link>)}
      <Link to={`/?feed=saved${suffix}`} aria-current={!search && view === 'saved' ? 'page' : undefined}><span>Saved</span>{saved.size > 0 && <span className="nav-suffix">{saved.size}</span>}</Link></div>
      <form className="search-form" role="search" onSubmit={submitSearch}><Icon name="search" size={14} /><input key={search} ref={searchInput} type="search" name="q" defaultValue={search} maxLength={200} placeholder="Search stories" aria-label="Search Hacker News stories" aria-keyshortcuts="/" />{search && <button type="button" className="text-button clear-search" onClick={() => void navigate(`/?feed=${view}${suffix}`)}>Clear</button>}</form></nav>
    <main id="reader" tabIndex={-1} className={`reader ${selected || invalid ? 'has-selection' : ''} ${selected && showArticle ? 'has-article' : ''}`}>
      <div className="feed-column">
        {feeds.map(value => <FeedPanel key={value} feed={value} active={!search && value === view} enabled={!search && visited.includes(value)} hideRead={hideRead} onHideRead={changeHideRead} {...listProps} />)}
        <SavedPanel active={!search && view === 'saved'} {...listProps} />
        {search && <SearchPanel key={search} query={search} active hideRead={hideRead} onHideRead={changeHideRead} {...listProps} />}
      </div>
      <div className="article-column">{opened.map(id => <Article key={id} id={id} active={id === selected} backTo={backTo} commentsTo={commentsTo} />)}</div>
      <div className="discussion-column">{invalid ? <div className="invalid-route"><h1>Nothing to read here.</h1><p>This link doesn’t point to a valid story.</p><Link to="/">Back to the front page</Link></div> : <>{!selected && <EmptyDiscussion />}{opened.map(id => <Discussion key={id} id={id} backTo={backTo} active={id === selected} articleTo={articleTo} showArticle={showArticle} saved={saved.has(id)} onToggleSaved={() => toggleSaved(id)} />)}</>}</div>
    </main>
    <Shortcuts open={helpOpen} onClose={() => setHelpOpen(false)} />
  </div>;
}
