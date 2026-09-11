import { useEffect, useRef } from 'react';

const keys: [string, string][] = [
  ['j / k', 'Move down and up the story list'],
  ['Enter', 'Open the discussion for the focused story'],
  ['r', 'Show or hide the article pane'],
  ['c', 'Show or hide the comments pane'],
  ['f', 'Show or hide the story list'],
  ['z', 'Focus mode — the article on its own'],
  ['n / p', 'Move down and up the comments'],
  ['N / P', 'Jump to the next and previous thread'],
  ['x', 'Collapse or expand the focused comment'],
  ['X', 'Collapse or expand every thread'],
  ['Enter', 'Show or hide the replies to the focused comment'],
  ['F', 'Find in this conversation'],
  ['m / M', 'Jump to the next and previous match'],
  ['o', 'Open the original article in a new tab'],
  ['a', 'Open the article on archive.is'],
  ['s', 'Save or unsave the story'],
  ['/', 'Search the whole Hacker News archive'],
  ['Esc', 'Back to the story list'],
  ['?', 'Show this list'],
];

// A native dialog carries the focus trap, the backdrop and Escape-to-close, so
// the only state to manage is when to open it.
export default function Shortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return <dialog className="sheet shortcuts" ref={dialog} aria-labelledby="shortcuts-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="sheet-inner">
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <dl>{keys.map(([key, description]) => <div key={description}><dt><kbd>{key}</kbd></dt><dd>{description}</dd></div>)}</dl>
      <div className="sheet-actions"><button type="button" className="secondary-button" onClick={onClose}>Close <kbd>Esc</kbd></button></div>
    </div>
  </dialog>;
}
