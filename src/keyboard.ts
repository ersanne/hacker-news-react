import { useEffect, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import { archiveUrl } from './format';

function rowLinks() {
  return [...document.querySelectorAll<HTMLAnchorElement>('.feed-panel:not([hidden]) [data-story-id] h2 a')];
}
function focusedRow(links: HTMLAnchorElement[], selected: number | null) {
  const index = links.indexOf(document.activeElement?.closest('[data-story-id]')?.querySelector('h2 a') as HTMLAnchorElement);
  const row = links[index]?.closest('[data-story-id]') ?? (selected ? document.querySelector(`.feed-panel:not([hidden]) [data-story-id="${selected}"]`) : null);
  return { index, row };
}

// Shortcuts read the rendered list because only one feed panel is visible at a
// time and its rows already carry story ids for focus restoration.
export function useKeyboardShortcuts({ selected, backTo, search, helpOpen, onHelp, onToggleArticle, onToggleSaved }: {
  selected: number | null;
  backTo: string;
  search: RefObject<HTMLInputElement | null>;
  helpOpen: boolean;
  onHelp: () => void;
  onToggleArticle: () => void;
  onToggleSaved: (id: number) => void;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // The help dialog handles its own Escape, and its content is not a feed.
      if (helpOpen) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) {
        if (event.key === 'Escape' && target === search.current) search.current?.blur();
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        onHelp();
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
        search.current?.select();
        return;
      }
      if (event.key === 'Escape' && selected) {
        event.preventDefault();
        void navigate(backTo);
        return;
      }
      if (event.key === 'r' && selected) {
        event.preventDefault();
        onToggleArticle();
        return;
      }
      if (!['j', 'k', 'o', 'a', 's'].includes(event.key)) return;
      const links = rowLinks();
      if (!links.length && !selected) return;
      const { index, row } = focusedRow(links, selected);
      if (event.key === 'o' || event.key === 'a') {
        const article = row?.querySelector<HTMLAnchorElement>('.story-domain a[href]');
        if (!article) return;
        event.preventDefault();
        window.open(event.key === 'a' ? archiveUrl(article.href) : article.href, '_blank', 'noopener,noreferrer');
        return;
      }
      if (event.key === 's') {
        const id = Number((row as HTMLElement | null)?.dataset.storyId ?? selected);
        if (!id) return;
        event.preventDefault();
        onToggleSaved(id);
        return;
      }
      if (!links.length) return;
      event.preventDefault();
      const next = index < 0 ? 0 : Math.min(links.length - 1, Math.max(0, index + (event.key === 'j' ? 1 : -1)));
      links[next].focus({ preventScroll: true });
      links[next].scrollIntoView({ block: 'nearest' });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, backTo, search, navigate, helpOpen, onHelp, onToggleArticle, onToggleSaved]);
}
