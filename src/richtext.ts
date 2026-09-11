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
const BULLET = /^\s*[-*]\s+(?=\S)/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(?=\S)/;
// A marker only means anything at the start of a line, so a paragraph is split
// into lines exactly when one of them carries one.
const MARKERS = [QUOTE, BULLET, NUMBER];

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

type Item = { paragraph: HTMLParagraphElement; ordered: boolean; number: number };

function listItem(paragraph: HTMLParagraphElement): Item | null {
  const text = paragraph.textContent ?? '';
  if (BULLET.test(text)) return { paragraph, ordered: false, number: 0 };
  const numbered = NUMBER.exec(text);
  return numbered ? { paragraph, ordered: true, number: Number(numbered[1]) } : null;
}

function buildList(items: Item[]) {
  const { ordered } = items[0];
  const numbers = items.map(item => item.number);
  // A numbered list that does not start at the top or does not climb is prose
  // that happens to begin with a figure.
  if (ordered && (numbers[0] > 1 || numbers.some((value, index) => index && value < numbers[index - 1]))) return;
  const list = document.createElement(ordered ? 'ol' : 'ul');
  if (ordered && numbers[0] !== 1) list.setAttribute('start', String(numbers[0]));
  items[0].paragraph.replaceWith(list);
  for (const { paragraph } of items) {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (first) first.nodeValue = (first.nodeValue ?? '').replace(ordered ? NUMBER : BULLET, '');
    const entry = document.createElement('li');
    entry.append(...paragraph.childNodes);
    paragraph.remove();
    list.append(entry);
  }
}

// A dash opens an aside as often as it opens a list, so a run of lines is
// lifted only once a second line agrees with the first.
function liftLists(root: ParentNode) {
  let run: Item[] = [];
  const flush = () => { if (run.length > 1) buildList(run); run = []; };
  for (const paragraph of [...root.querySelectorAll('p')]) {
    const item = listItem(paragraph);
    if (!item) { flush(); continue; }
    const last = run[run.length - 1];
    if (last && (last.ordered !== item.ordered || last.paragraph.nextElementSibling !== paragraph)) flush();
    run.push(item);
  }
  flush();
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
// content, but it cannot introduce markup that neither list names.
export function parseComment(value: string): RichNode[] {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(value, { ALLOWED_TAGS: COMMENT_TAGS, ALLOWED_ATTR: ['href', 'title'] });
  wrapLeadingBlock(template.content);
  for (const paragraph of [...template.content.querySelectorAll('p')]) splitLines(paragraph);
  liftQuotes(template.content);
  liftLists(template.content);
  return [...template.content.childNodes].flatMap(child => toNode(child) ?? []);
}
