import { createElement, memo, useMemo, type ReactNode } from 'react';
import { parseComment, type RichNode } from '../richtext';
import { safeUrl } from '../format';
import { ExternalLink } from './ui';

const VOID_TAGS = new Set(['br']);

function render(node: RichNode, key: number): ReactNode {
  if (typeof node === 'string') return node;
  const children = node.children.map(render);
  if (node.tag === 'a') {
    // Links are the one place a pass sets an attribute, so the href is checked
    // again here rather than trusted from the tree.
    const href = safeUrl(node.attrs.href);
    return href ? <ExternalLink key={key} href={href}>{children}</ExternalLink> : <span key={key}>{children}</span>;
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
