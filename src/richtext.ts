import DOMPurify from 'dompurify';

// HN sends almost no markup: paragraphs, links, italics and code blocks. Every
// other convention in a comment — quotes, lists, backticks — is plain text the
// author typed, and each pass below lifts one of them into real markup.
const COMMENT_TAGS = ['p', 'a', 'em', 'i', 'strong', 'b', 'code', 'pre', 'blockquote', 'br', 'ul', 'ol', 'li'];
// Attributes reach the render from here, so each tag names the ones it may
// carry rather than forwarding whatever survived sanitising.
const ATTRIBUTES: Record<string, string[]> = { a: ['href', 'title'], ol: ['start'] };

export type RichNode = string | { tag: string; attrs: Record<string, string>; children: RichNode[] };

const BLOCKS = new Set(['P', 'PRE', 'BLOCKQUOTE', 'UL', 'OL']);
// HN opens a comment with bare text and only starts a <p> at the first blank
// line, so the opening block is wrapped to give it the paragraph the rest of
// the passes — and the paragraph spacing — expect every block to have.
function wrapLeadingBlock(root: ParentNode) {
  const leading: Node[] = [];
  for (const node of root.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCKS.has((node as Element).tagName)) break;
    leading.push(node);
  }
  if (!leading.some(node => (node.textContent ?? '').trim())) return;
  const paragraph = document.createElement('p');
  root.insertBefore(paragraph, leading[0]);
  paragraph.append(...leading);
}

// HN marks quoted text with a leading ">" in the paragraph itself, so the
// markers are lifted into real blockquotes and adjacent quoted lines join up.
function liftQuotes(root: ParentNode) {
  let quote: HTMLQuoteElement | null = null;
  for (const paragraph of [...root.querySelectorAll('p')]) {
    if (!/^\s*>/.test(paragraph.textContent ?? '')) { quote = null; continue; }
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) first.nodeValue = (first.nodeValue ?? '').replace(/^\s*>+\s?/, '');
    if (!quote || paragraph.previousElementSibling !== quote) {
      quote = document.createElement('blockquote');
      paragraph.replaceWith(quote);
    }
    quote.append(paragraph);
  }
}

function toNode(node: Node): RichNode | null {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (!COMMENT_TAGS.includes(tag)) return null;
  const attrs: Record<string, string> = {};
  for (const name of ATTRIBUTES[tag] ?? []) {
    const value = element.getAttribute(name);
    if (value !== null) attrs[name] = value;
  }
  return { tag, attrs, children: [...element.childNodes].flatMap(child => toNode(child) ?? []) };
}

// The tree is what the comment renders from, so the tags it can carry are
// fixed here as well as in the sanitiser: a fault in a pass above can lose
// content, but it cannot introduce markup neither list names.
export function parseComment(value: string): RichNode[] {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(value, { ALLOWED_TAGS: COMMENT_TAGS, ALLOWED_ATTR: ['href', 'title'] });
  wrapLeadingBlock(template.content);
  liftQuotes(template.content);
  return [...template.content.childNodes].flatMap(child => toNode(child) ?? []);
}
