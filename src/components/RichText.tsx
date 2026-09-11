import { createElement, Fragment, memo, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { parseComment, type RichNode } from '../richtext';
import { safeUrl } from '../format';
import { ExternalLink, Icon } from './ui';
import { useCopy } from '../copy';
import { flag, useFlag } from '../storage';

const VOID_TAGS = new Set(['br']);
const CARRIED = ['feed', 'q', 'article', 'panes'];

// An HN item link points at something this reader already knows how to show,
// so it opens here, in the arrangement of panes the reader is already using.
function itemId(href: string) {
  const url = new URL(href);
  if (url.hostname.replace(/^www\./, '') !== 'news.ycombinator.com' || url.pathname !== '/item') return null;
  const id = Number(url.searchParams.get('id'));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function CommentLink({ href, children }: { href: string; children: ReactNode }) {
  const location = useLocation();
  const id = itemId(href);
  if (id === null) return <ExternalLink href={href}>{children}</ExternalLink>;
  const params = new URLSearchParams({ id: String(id) });
  const current = new URLSearchParams(location.search);
  for (const name of CARRIED) {
    const value = current.get(name);
    if (value !== null) params.set(name, value);
  }
  return <Link to={`/item?${params.toString()}`}>{children}</Link>;
}

// Marks are put in as React children, so what is marked stays text and the
// sanitised tree is never rebuilt from a string to hold them.
function marked(value: string, highlight: string, key: number): ReactNode {
  const needle = highlight.toLowerCase();
  const haystack = value.toLowerCase();
  const parts: ReactNode[] = [];
  let read = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, read)) {
    if (at > read) parts.push(value.slice(read, at));
    parts.push(<mark key={parts.length}>{value.slice(at, at + needle.length)}</mark>);
    read = at + needle.length;
  }
  if (!parts.length) return value;
  if (read < value.length) parts.push(value.slice(read));
  return <Fragment key={key}>{parts}</Fragment>;
}

function text(node: RichNode): string {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}

// Wrapping is a preference rather than a property of one block, so every block
// on the page follows it and it outlives the comment that prompted it.
const codeWrap = flag('hn-code-wrap', false);
// Enough code to read the shape of it; past that a block sets the length of
// the comment it sits in.
const FOLD_LINES = 15;

// A block wide enough to scroll cannot hold its own controls: they would slide
// out of reach with the code. The wrapper holds them still instead.
function CodeBlock({ node, highlight }: { node: RichNode; highlight?: string }) {
  const code = text(node);
  const [state, copy] = useCopy();
  const wrap = useFlag(codeWrap);
  const [open, setOpen] = useState(false);
  const lines = code.split('\n').length;
  const folded = lines > FOLD_LINES && !open;
  return <div className="code-block" data-wrap={wrap ? 'on' : 'off'} data-folded={folded ? 'on' : 'off'}>
    <div className="code-tools">
      <button type="button" aria-label="Wrap long lines" title="Wrap long lines" aria-pressed={wrap} onClick={() => codeWrap.set(!wrap)}>
        <Icon name="wrap" size={13} />
      </button>
      <button type="button" aria-label="Copy code" title="Copy code" data-state={state} onClick={() => copy(code)}>
        <Icon name="copy" size={13} /><span role="status">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
      </button>
    </div>
    {/* A region that scrolls has to be reachable by the keyboard too. The fold
        is a visual clamp, so the text stays whole for anything reading it. */}
    <pre tabIndex={0} role="region" aria-label="Code block">{typeof node === 'string' ? node : node.children.map((child, index) => render(child, index, highlight))}</pre>
    {lines > FOLD_LINES && <button type="button" className="text-button code-fold" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Show less' : `Show all ${lines} lines`}
    </button>}
  </div>;
}

function render(node: RichNode, key: number, highlight?: string): ReactNode {
  if (typeof node === 'string') return highlight ? marked(node, highlight, key) : node;
  const children = node.children.map((child, index) => render(child, index, highlight));
  if (node.tag === 'pre') return <CodeBlock key={key} node={node} highlight={highlight} />;
  if (node.tag === 'a') {
    // Links are the one place a pass sets an attribute, so the href is checked
    // again here rather than trusted from the tree.
    const href = safeUrl(node.attrs.href);
    return href ? <CommentLink key={key} href={href}>{children}</CommentLink> : <span key={key}>{children}</span>;
  }
  return createElement(node.tag, { key, ...node.attrs }, VOID_TAGS.has(node.tag) ? undefined : children);
}

// A comment's tree is derived from text that never changes, so a node keeps
// its position between renders and its index is a stable key.
function RichText({ text, highlight }: { text: string; highlight?: string }) {
  const nodes = useMemo(() => parseComment(text), [text]);
  return <div className="prose">{nodes.map((node, index) => render(node, index, highlight))}</div>;
}
export default memo(RichText);
