import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { clearCache, feeds, type Feed } from './api';
import Article from './components/Article';
import FeedPanel from './components/FeedPanel';
import SavedPanel from './components/SavedPanel';
import SearchPanel from './components/SearchPanel';
import Shortcuts from './components/Shortcuts';
import ViewSettings from './components/ViewSettings';
import Discussion, { EmptyDiscussion } from './components/Discussion';
import { Icon } from './components/ui';
import { useKeyboardShortcuts } from './keyboard';
import { tabLabels } from './feeds';
import { usePageMeta } from './seo';
import { SettingsProvider, useSettings } from './settings';
import { readStorage, useReadStories, useSavedStories, writeStorage } from './storage';

type Theme = 'system' | 'light' | 'dark';
type View = Feed | 'saved';
const views: View[] = [...feeds, 'saved'];
// Below this width the reading panes are exclusive rather than side by side
// (styles.css draws the same line), so the article is a view to leave rather
// than an arrangement to carry back to the list.
const SINGLE_PANE = '(max-width: 1399px)';

function useMediaQuery(query: string) {
  const list = useMemo(() => window.matchMedia(query), [query]);
  return useSyncExternalStore(
    onChange => {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => list.matches,
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const view = views.includes(query.get('feed') as View) ? query.get('feed') as View : 'top';
  const search = (query.get('q') ?? '').trim().slice(0, 200);
  const rawId = query.get('id');
  // A static host is free to answer /item with a redirect to /item/, so the
  // trailing slash names the same story.
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const selected = path === '/item' && rawId && /^\d+$/.test(rawId) && Number.isSafeInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const invalid = path !== '/' && (path !== '/item' || !selected);
  const showArticle = query.get('article') === '1';
  const singlePane = useMediaQuery(SINGLE_PANE);
  const suffix = showArticle && !singlePane ? '&article=1' : '';
  const panes = new Set((query.get('panes') ?? '').split(',').filter(Boolean));
  // A pane can only be dropped while a story is open, and never the last one
  // left: hiding the comments is offered alongside the article, not instead of it.
  const hideFeed = !!selected && panes.has('nofeed');
  const hideComments = !!selected && showArticle && panes.has('nocomments');
  const backTo = search ? `/?q=${encodeURIComponent(search)}${suffix}` : `/?feed=${view}${suffix}`;
  const [visited, setVisited] = useState<Feed[]>(search || view === 'saved' ? [] : [view]);
  const [opened, setOpened] = useState<number[]>(selected ? [selected] : []);
  const { read, markRead } = useReadStories();
  const { saved, toggleSaved } = useSavedStories();
  const [hideRead, setHideRead] = useState(() => readStorage('hn-hide-read') === '1');
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, updateSettings] = useSettings();
  const [refreshAt, setRefreshAt] = useState(0);
  const [checkAt, setCheckAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
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
  function panesTo(next: Set<string>, article = showArticle) {
    const params = new URLSearchParams(location.search);
    if (article) params.set('article', '1'); else params.delete('article');
    if (next.size) params.set('panes', [...next].join(',')); else params.delete('panes');
    return `${location.pathname}?${params.toString()}`;
  }
  function paneToggleTo(pane: 'nofeed' | 'nocomments') {
    const next = new Set(panes);
    if (next.has(pane)) next.delete(pane); else next.add(pane);
    // Hiding the comments only means anything once there is an article to read.
    return panesTo(next, showArticle || next.has('nocomments'));
  }
  const focusTo = hideFeed && hideComments ? panesTo(new Set()) : panesTo(new Set(['nofeed', 'nocomments']), true);
  const showPanesTo = panesTo(new Set());
  const toggleArticle = useCallback(() => {
    const next = new URLSearchParams(location.search);
    if (showArticle) next.delete('article'); else next.set('article', '1');
    void navigate(`${location.pathname}?${next.toString()}`);
  }, [location.pathname, location.search, showArticle, navigate]);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const togglePane = useCallback((pane: 'nofeed' | 'nocomments') => void navigate(paneToggleTo(pane)), [paneToggleTo, navigate]);
  const enterFocus = useCallback(() => void navigate(focusTo), [focusTo, navigate]);
  const showPanes = useCallback(() => void navigate(showPanesTo), [showPanesTo, navigate]);
  const reportBusy = useCallback((busy: boolean) => setRefreshing(busy), []);

  useKeyboardShortcuts({
    selected, backTo, search: searchInput, dialogOpen: helpOpen || settingsOpen, panesHidden: hideFeed || hideComments,
    onHelp: openHelp, onToggleArticle: toggleArticle, onTogglePane: togglePane,
    onFocusMode: enterFocus, onShowPanes: showPanes, onToggleSaved: toggleSaved,
  });
  // An open story describes the page from Discussion, which is the only place
  // that knows its title.
  usePageMeta(selected ? null
    : invalid ? { kind: 'invalid' }
    : search ? { kind: 'search', query: search }
    : view === 'saved' ? { kind: 'saved' }
    : { kind: 'feed', feed: view });
  useEffect(() => {
    if (!search && view !== 'saved') setVisited(previous => previous.includes(view) ? previous : [...previous, view]);
  }, [view, search]);
  useEffect(() => {
    if (!selected) return;
    setOpened(previous => [...previous.filter(id => id !== selected), selected].slice(-10));
    markRead(selected);
  }, [selected, markRead]);
  useLayoutEffect(() => {
    if (!selected && previousSelection.current) {
      const row = document.querySelector<HTMLAnchorElement>(`.feed-panel:not([hidden]) [data-story-id="${previousSelection.current}"] h2 a`);
      // A hidden row cannot take focus, so the reader itself catches it.
      if (row?.offsetParent) row.focus({ preventScroll: true });
      else document.getElementById('reader')?.focus({ preventScroll: true });
    }
    previousSelection.current = selected;
  }, [selected]);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    writeStorage('hn-theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!settings.refresh) return;
    // Checked at the tick rather than by tearing the timer down, so a tab that
    // is briefly backgrounded keeps its cadence.
    const id = setInterval(() => { if (document.visibilityState === 'visible') setCheckAt(Date.now()); }, settings.refresh * 60_000);
    return () => clearInterval(id);
  }, [settings.refresh]);
  function refreshNow() {
    clearCache();
    setRefreshAt(Date.now());
  }
  function changeHideRead(on: boolean) {
    setHideRead(on);
    writeStorage('hn-hide-read', on ? '1' : '');
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = searchInput.current?.value.trim() ?? '';
    void navigate(value ? `/?q=${encodeURIComponent(value)}${suffix}` : `/?feed=${view}${suffix}`);
  }

  const paneButtons = settings.order === 'article-first' ? ['article', 'comments'] : ['comments', 'article'];
  const listProps = { selected, read, onRead: markRead, saved, onToggleSaved: toggleSaved, hrefSuffix: suffix };
  const feedProps = { refreshAt, checkAt, onBusy: reportBusy };
  return <SettingsProvider value={settings}><div className="app-shell" data-width={settings.width} data-density={settings.density} data-order={settings.order}>
    <a className="skip-link" href="#reader">Skip to reader</a>
    <header className="app-header">
      <Link className="brand" to="/" aria-label="HN Reader home"><span className="brand-mark">Y</span><span className="brand-word">hn<span className="brand-light">reader</span><span className="brand-period">.</span></span></Link>
      <span className="header-tagline">A quieter corner of Hacker News.</span>
      <div className="header-tools">
        <form className="search-form" role="search" onSubmit={submitSearch}><Icon name="search" size={14} /><input key={search} ref={searchInput} type="search" name="q" defaultValue={search} maxLength={200} placeholder="Search stories" aria-label="Search Hacker News stories" aria-keyshortcuts="/" />{search && <button type="button" className="text-button clear-search" onClick={() => void navigate(`/?feed=${view}${suffix}`)}>Clear</button>}</form>
        {/* All three panes are toggled from one place, so each pane's own
            toolbar is left to actions on its content. */}
        {selected && <div className="mode-switch pane-switch" role="group" aria-label="Panes">
          <button type="button" data-pane="list" aria-pressed={!hideFeed} onClick={() => togglePane('nofeed')}>List</button>
          {/* The two reading panes follow the middle-column setting, so the
              buttons read left to right in the order the panes appear. */}
          {paneButtons.map(pane => pane === 'comments'
            ? <button key={pane} type="button" data-pane="comments" aria-pressed={!hideComments} onClick={() => togglePane('nocomments')}>Comments</button>
            : <button key={pane} type="button" data-pane="article" aria-pressed={showArticle} onClick={toggleArticle}>Article</button>)}
        </div>}
        {selected && <button type="button" className="icon-button pane-focus" aria-pressed={hideFeed && hideComments} aria-label={hideFeed && hideComments ? 'Leave focus mode' : 'Focus mode'} title={hideFeed && hideComments ? 'Leave focus mode' : 'Focus mode'} onClick={enterFocus}><Icon name="focus" size={14} /></button>}
        <div className="theme-control">
          {!settings.heading && <button type="button" className={`icon-button refresh ${refreshing ? 'is-loading' : ''}`} aria-label="Refresh stories" title="Refresh stories" disabled={refreshing} onClick={refreshNow}><Icon name="refresh" size={16} /></button>}
          <button type="button" className="icon-button" aria-label="View settings" title="View settings" onClick={() => setSettingsOpen(true)}><Icon name="sliders" size={16} /></button>
          <button type="button" className="icon-button header-help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick={openHelp}><Icon name="help" size={16} /></button>
          <Icon name="sun" size={16} />
          <select aria-label="Color theme" value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
        </div>
      </div>
    </header>
    <nav className="feed-nav" aria-label="Story feeds"><div className="feed-tabs">{feeds.map(value => <Link key={value} to={`/?feed=${value}${suffix}`} aria-current={!search && value === view ? 'page' : undefined}><span>{value === 'top' && <span className="tab-star" aria-hidden="true">✳</span>}{tabLabels[value]}</span></Link>)}
      <Link to={`/?feed=saved${suffix}`} aria-current={!search && view === 'saved' ? 'page' : undefined}><span>Saved</span>{saved.size > 0 && <span className="nav-suffix">{saved.size}</span>}</Link></div></nav>
    <main id="reader" tabIndex={-1} className={`reader ${selected || invalid ? 'has-selection' : ''} ${selected && showArticle ? 'has-article' : ''} ${hideFeed ? 'hide-feed' : ''} ${hideComments ? 'hide-comments' : ''}`}>
      <div className="feed-column">
        {feeds.map(value => <FeedPanel key={value} feed={value} active={!search && value === view} enabled={!search && visited.includes(value)} hideRead={hideRead} onHideRead={changeHideRead} {...listProps} {...feedProps} />)}
        <SavedPanel active={!search && view === 'saved'} {...listProps} />
        {search && <SearchPanel key={search} query={search} active hideRead={hideRead} onHideRead={changeHideRead} {...listProps} {...feedProps} />}
      </div>
      <div className="article-column">{opened.map(id => <Article key={id} id={id} active={id === selected} shown={showArticle} backTo={backTo} commentsTo={commentsTo} />)}</div>
      <div className="discussion-column">{invalid ? <div className="invalid-route"><h1>Nothing to read here.</h1><p>This link doesn’t point to a valid story.</p><Link to="/">Back to the front page</Link></div> : <>{!selected && <EmptyDiscussion />}{opened.map(id => <Discussion key={id} id={id} backTo={backTo} active={id === selected} articleTo={articleTo} showArticle={showArticle} saved={saved.has(id)} onToggleSaved={() => toggleSaved(id)} />)}</>}</div>
    </main>
    <ViewSettings open={settingsOpen} settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)}
      onShortcuts={() => { setSettingsOpen(false); setHelpOpen(true); }} />
    <Shortcuts open={helpOpen} onClose={() => setHelpOpen(false)} />
  </div></SettingsProvider>;
}
