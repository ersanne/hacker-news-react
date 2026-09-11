import { useEffect, type RefObject } from 'react';
import { useNavigate } from 'react-router';

function rowLinks() {
  return [...document.querySelectorAll<HTMLAnchorElement>('.feed-panel:not([hidden]) [data-story-id] h2 a')];
}

// Shortcuts read the rendered list because only one feed panel is visible at a
// time and its rows already carry story ids for focus restoration.
export function useKeyboardShortcuts({ selected, backTo, search }: {
  selected: number | null;
  backTo: string;
  search: RefObject<HTMLInputElement | null>;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) {
        if (event.key === 'Escape' && target === search.current) search.current?.blur();
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
      if (event.key !== 'j' && event.key !== 'k' && event.key !== 'o') return;
      const links = rowLinks();
      if (!links.length) return;
      const focused = links.indexOf(document.activeElement?.closest('[data-story-id]')?.querySelector('h2 a') as HTMLAnchorElement);
      if (event.key === 'o') {
        const row = links[focused]?.closest('[data-story-id]') ?? (selected ? document.querySelector(`.feed-panel:not([hidden]) [data-story-id="${selected}"]`) : null);
        const article = row?.querySelector<HTMLAnchorElement>('.story-domain a[href]');
        if (!article) return;
        event.preventDefault();
        window.open(article.href, '_blank', 'noopener,noreferrer');
        return;
      }
      event.preventDefault();
      const next = focused < 0 ? 0 : Math.min(links.length - 1, Math.max(0, focused + (event.key === 'j' ? 1 : -1)));
      links[next].focus({ preventScroll: true });
      links[next].scrollIntoView({ block: 'nearest' });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, backTo, search, navigate]);
}
