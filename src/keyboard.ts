import { useEffect, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import { archiveUrl } from './format';

// focus() is a silent no-op on a hidden element, so a hidden feed column must
// yield no rows at all rather than rows that cannot be reached.
function rowLinks() {
  return [...document.querySelectorAll<HTMLAnchorElement>('.feed-panel:not([hidden]) [data-story-id] h2 a')]
    .filter(link => link.offsetParent !== null);
}
// The open story stands in for a focused row, so leaving the list and coming
// back — or reading the discussion — resumes where the reader is rather than
// at the top.
function focusedRow(links: HTMLAnchorElement[], selected: number | null) {
  const row = document.activeElement?.closest<HTMLElement>('[data-story-id]')
    ?? (selected ? document.querySelector<HTMLElement>(`.feed-panel:not([hidden]) [data-story-id="${selected}"]`) : null);
  return { index: links.indexOf(row?.querySelector('h2 a') as HTMLAnchorElement), row };
}

// Replies below the batch limit are not rendered and a collapsed comment sits
// in a hidden block, so what is laid out is exactly what can be stepped through.
function commentNodes(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(`.discussion-panel:not([hidden]) ${selector}`)]
    .filter(comment => comment.offsetParent !== null);
}
function focusComment(comment: HTMLElement | undefined) {
  if (!comment) return;
  comment.focus({ preventScroll: true });
  comment.scrollIntoView({ block: 'nearest' });
}

// Shortcuts read the rendered list because only one feed panel is visible at a
// time and its rows already carry story ids for focus restoration.
export function useKeyboardShortcuts({ selected, backTo, search, dialogOpen, panesHidden, onHelp, onToggleArticle, onTogglePane, onFocusMode, onShowPanes, onToggleSaved }: {
  selected: number | null;
  backTo: string;
  search: RefObject<HTMLInputElement | null>;
  dialogOpen: boolean;
  panesHidden: boolean;
  onHelp: () => void;
  onToggleArticle: () => void;
  onTogglePane: (pane: 'nofeed' | 'nocomments') => void;
  onFocusMode: () => void;
  onShowPanes: () => void;
  onToggleSaved: (id: number) => void;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // An open dialog handles its own Escape, and its content is not a feed.
      if (dialogOpen) return;
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
        // Panes come back before the story closes, so a hidden list is never a
        // dead end for anyone who did not press the key that hid it.
        if (panesHidden) onShowPanes(); else void navigate(backTo);
        return;
      }
      if (['r', 'c', 'f', 'z'].includes(event.key) && selected) {
        event.preventDefault();
        if (event.key === 'r') onToggleArticle();
        else if (event.key === 'c') onTogglePane('nocomments');
        else if (event.key === 'f') onTogglePane('nofeed');
        else onFocusMode();
        return;
      }
      if (event.key === 'F') {
        const finding = document.querySelector<HTMLInputElement>('.discussion-panel:not([hidden]) .find-control input');
        if (!finding) return;
        event.preventDefault();
        finding.focus();
        finding.select();
        return;
      }
      if (event.key === 'm' || event.key === 'M') {
        const step = document.querySelector<HTMLButtonElement>(`.discussion-panel:not([hidden]) .find-${event.key === 'm' ? 'next' : 'previous'}`);
        if (!step || step.disabled) return;
        event.preventDefault();
        step.click();
        return;
      }
      if (event.key === 'X') {
        const fold = document.querySelector<HTMLButtonElement>('.discussion-panel:not([hidden]) .collapse-all');
        if (!fold) return;
        event.preventDefault();
        fold.click();
        return;
      }
      const comment = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.comment') ?? null;
      if (event.key === 'x' || event.key === 'Enter') {
        // Enter stays with whatever holds it — a story link, a button — unless
        // that is the comment body itself.
        if (!comment || (event.key === 'Enter' && document.activeElement !== comment)) return;
        event.preventDefault();
        comment.querySelector<HTMLButtonElement>(event.key === 'x' ? ':scope > .comment-header > .collapse-target' : ':scope > div > .reply-toggle')?.click();
        return;
      }
      if (['n', 'p', 'N', 'P'].includes(event.key)) {
        const top = event.key === 'N' || event.key === 'P';
        const step = event.key === 'n' || event.key === 'N' ? 1 : -1;
        const selector = top ? '.comments-list > .comment' : '.comment';
        const comments = commentNodes(selector);
        if (!comments.length) return;
        event.preventDefault();
        // From a reply, the thread keys move on from the thread it belongs to.
        const from = top ? comment?.closest<HTMLElement>('.comments-list > .comment') ?? null : comment;
        const index = from ? comments.indexOf(from) : -1;
        if (index < 0) return focusComment(comments[0]);
        if (index === comments.length - 1 && step > 0) {
          const more = commentNodes('.more-comments')
            .find(button => from!.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
          if (!more) return;
          more.click();
          // React commits in a microtask, so the new batch is laid out by the frame.
          requestAnimationFrame(() => focusComment(commentNodes(selector)[index + 1]));
          return;
        }
        return focusComment(comments[Math.max(0, index + step)]);
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
        const id = Number(row?.dataset.storyId ?? selected);
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
  }, [selected, backTo, search, navigate, dialogOpen, panesHidden, onHelp, onToggleArticle, onTogglePane, onFocusMode, onShowPanes, onToggleSaved]);
}
