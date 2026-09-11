import { createElement, memo, useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { parseComment, type RichNode } from '../richtext';
import { safeUrl } from '../format';
import { ExternalLink } from './ui';

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

function render(node: RichNode, key: number): ReactNode {
  if (typeof node === 'string') return node;
  const children = node.children.map(render);
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
function RichText({ text }: { text: string }) {
  const nodes = useMemo(() => parseComment(text), [text]);
  return <div className="prose">{nodes.map(render)}</div>;
}
export default memo(RichText);
