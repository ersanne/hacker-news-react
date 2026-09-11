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

const QUOTE = /^(\s*>+)\s?/;
// Deep enough for a reply quoting a reply; past that the indent costs more
// column than the nesting explains.
const MAX_QUOTE = 4;
// A marker only means anything at the start of a line, so a paragraph is split
// into lines exactly when one of them carries one.
const MARKERS = [QUOTE];

// HN starts a paragraph at a blank line and leaves a single newline in the
// text, where it renders as a space. Lines that open with a marker were meant
// to stand alone, so those paragraphs are split and the rest are left as the
// single run of prose HN shows.
function splitLines(paragraph: HTMLParagraphElement) {
  const text = paragraph.textContent ?? '';
  if (!text.includes('\n')) return;
  if (!text.split('\n').some(line => MARKERS.some(marker => marker.test(line)))) return;
  const lines: Node[][] = [[]];
  for (const node of [...paragraph.childNodes]) {
    const value = node.nodeType === Node.TEXT_NODE ? node.nodeValue ?? '' : null;
    if (value === null || !value.includes('\n')) { lines[lines.length - 1].push(node); continue; }
    value.split('\n').forEach((piece, index) => {
      if (index) lines.push([]);
      if (piece) lines[lines.length - 1].push(document.createTextNode(piece));
    });
  }
  paragraph.replaceWith(...lines.filter(nodes => nodes.length).map(nodes => {
    const line = document.createElement('p');
    line.append(...nodes);
    return line;
  }));
}

// HN marks quoted text with a leading ">" in the paragraph itself, so the
// markers are lifted into real blockquotes, adjacent quoted lines join up, and
// a run of ">" nests as deeply as it counts.
function liftQuotes(root: ParentNode) {
  let stack: HTMLQuoteElement[] = [];
  for (const paragraph of [...root.querySelectorAll('p')]) {
    const marker = QUOTE.exec(paragraph.textContent ?? '');
    if (!marker) { stack = []; continue; }
    // A quote continues only while its paragraphs stay adjacent to it.
    if (stack.length && paragraph.previousElementSibling !== stack[0]) stack = [];
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) first.nodeValue = (first.nodeValue ?? '').replace(QUOTE, '');
    const depth = Math.min(marker[1].replace(/\s/g, '').length, MAX_QUOTE);
    stack.length = Math.min(stack.length, depth);
    while (stack.length < depth) {
      const quote = document.createElement('blockquote');
      if (stack.length) stack[stack.length - 1].append(quote);
      else paragraph.replaceWith(quote);
      stack.push(quote);
    }
    stack[stack.length - 1].append(paragraph);
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
  for (const paragraph of [...template.content.querySelectorAll('p')]) splitLines(paragraph);
  liftQuotes(template.content);
  return [...template.content.childNodes].flatMap(child => toNode(child) ?? []);
}
