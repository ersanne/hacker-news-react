import { describe, expect, it } from 'vitest';
import { COMMENT_TAGS, parseComment, type RichNode } from './richtext';

// The tree renders through React, so assertions read it back as the markup it
// stands for rather than walking nested objects. Text is escaped the way React
// escapes it, so a string child never reads as though it were markup.
function html(nodes: RichNode[]): string {
  return nodes.map(node => {
    if (typeof node === 'string') return node.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const attrs = Object.entries(node.attrs).map(([name, value]) => ` ${name}="${value}"`).join('');
    return `<${node.tag}${attrs}>${html(node.children)}</${node.tag}>`;
  }).join('');
}
const parse = (value: string) => html(parseComment(value));

function tags(nodes: RichNode[]): string[] {
  return nodes.flatMap(node => typeof node === 'string' ? [] : [node.tag, ...tags(node.children)]);
}

describe('comment text conventions', () => {
  it('preserves readable formatting while stripping scripts, handlers, and unsafe links', () => {
    const result = parse('<p>Hello <em>world</em><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><a href="https://example.com" onclick="alert(1)">good</a></p><pre><code>const x = 1</code></pre>');
    expect(result).toContain('<em>world</em>');
    expect(result).toContain('<pre><code>const x = 1</code></pre>');
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toMatch(/script|onerror|onclick|<img/);
  });
  it('admits no tag the renderer does not name, whatever reaches it', () => {
    const nasty = '<p>text<iframe src="x"></iframe><form><input><button>go</button></form><style>p{}</style><svg><use href="#x"/></svg></p>';
    expect(tags(parseComment(nasty)).filter(tag => !COMMENT_TAGS.includes(tag))).toEqual([]);
  });
  it('gives the opening block of a comment the paragraph HN leaves off', () => {
    expect(parse('First line<p>Second line')).toBe('<p>First line</p><p>Second line</p>');
    expect(parse('Text with <i>markup</i><p>Second')).toBe('<p>Text with <i>markup</i></p><p>Second</p>');
    expect(parse('<p>Already a paragraph')).toBe('<p>Already a paragraph</p>');
    expect(parse('<pre><code>code first</code></pre><p>After')).toBe('<pre><code>code first</code></pre><p>After</p>');
  });
  it('lifts a quote that opens a comment, where HN writes no paragraph at all', () => {
    expect(parse('&gt; quoted<p>A reply')).toBe('<blockquote><p>quoted</p></blockquote><p>A reply</p>');
  });
  it('turns the plain-text quote markers HN uses into blockquotes', () => {
    expect(parse('<p>&gt; first line</p><p>&gt; second line</p><p>A reply</p>'))
      .toBe('<blockquote><p>first line</p><p>second line</p></blockquote><p>A reply</p>');
  });
  it('nests a quote as deeply as its markers count, and unwinds again', () => {
    expect(parse('<p>&gt; a</p><p>&gt;&gt; b</p><p>&gt; c</p>'))
      .toBe('<blockquote><p>a</p><blockquote><p>b</p></blockquote><p>c</p></blockquote>');
  });
  it('stops indenting a quote war before it runs out of column', () => {
    expect(parse('<p>&gt;&gt;&gt;&gt;&gt;&gt; deep</p>'))
      .toBe('<blockquote><blockquote><blockquote><blockquote><p>deep</p></blockquote></blockquote></blockquote></blockquote>');
  });
  it('splits a paragraph into lines only where a line carries a marker', () => {
    expect(parse('<p>&gt; first\n&gt; second</p>')).toBe('<blockquote><p>first</p><p>second</p></blockquote>');
    expect(parse('<p>Prose that\nwraps in the source</p>')).toBe('<p>Prose that\nwraps in the source</p>');
    expect(parse('<p>Intro:\n&gt; quoted</p>')).toBe('<p>Intro:</p><blockquote><p>quoted</p></blockquote>');
  });
  it('keeps the markup inside a line it splits', () => {
    expect(parse('<p>&gt; see <a href="https://example.com">this</a>\n&gt; and that</p>'))
      .toBe('<blockquote><p>see <a href="https://example.com">this</a></p><p>and that</p></blockquote>');
  });
  it('lifts a run of marked lines into a list', () => {
    expect(parse('<p>- one</p><p>- two</p>')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(parse('<p>1. one</p><p>2. two</p>')).toBe('<ol><li>one</li><li>two</li></ol>');
    expect(parse('<p>Checklists:\n- one\n- two</p>')).toBe('<p>Checklists:</p><ul><li>one</li><li>two</li></ul>');
  });
  it('leaves a single dashed line as the aside it probably is', () => {
    expect(parse('<p>- and that is the point</p>')).toBe('<p>- and that is the point</p>');
    expect(parse('<p>1985. A good year</p><p>Unrelated</p>')).toBe('<p>1985. A good year</p><p>Unrelated</p>');
  });
  it('lifts a numbered list only where the numbers read as one', () => {
    expect(parse('<p>0. zero</p><p>1. one</p>')).toBe('<ol start="0"><li>zero</li><li>one</li></ol>');
    // Lines that merely begin with a figure — years, versions, a list resumed
    // from an earlier comment — are left as the prose they are.
    expect(parse('<p>1985. A good year</p><p>2001. Another</p>')).toBe('<p>1985. A good year</p><p>2001. Another</p>');
    expect(parse('<p>9. nine</p><p>2. two</p>')).toBe('<p>9. nine</p><p>2. two</p>');
  });
  it('lifts a list that was typed inside a quote', () => {
    expect(parse('<p>&gt; - one</p><p>&gt; - two</p>')).toBe('<blockquote><ul><li>one</li><li>two</li></ul></blockquote>');
  });
  it('marks backticked text as code, where HN offers no inline markup at all', () => {
    expect(parse('<p>Use `npm run build` first</p>')).toBe('<p>Use <code>npm run build</code> first</p>');
    expect(parse('<p>`a` and `b`</p>')).toBe('<p><code>a</code> and <code>b</code></p>');
  });
  it('leaves backticks alone where the text already stands for something', () => {
    expect(parse('<pre><code>let x = `y`</code></pre>')).toBe('<pre><code>let x = `y`</code></pre>');
    expect(parse('<p><a href="https://example.com/`x`">link</a></p>')).toBe('<p><a href="https://example.com/`x`">link</a></p>');
    expect(parse('<p>an ` unmatched tick</p>')).toBe('<p>an ` unmatched tick</p>');
    expect(parse('<p>empty `` pair</p>')).toBe('<p>empty `` pair</p>');
  });
  it('reads a code span as text, so markup inside one cannot escape it', () => {
    expect(parse('<p>`&lt;b&gt;bold&lt;/b&gt;`</p>')).toBe('<p><code>&lt;b&gt;bold&lt;/b&gt;</code></p>');
  });
  it('joins a footnote marker up to the source it names', () => {
    expect(parse('<p>As shown [1]</p><p>[1] https://example.com/paper</p>'))
      .toBe('<p>As shown <a href="https://example.com/paper"><sup>[1]</sup></a></p><p>[1] https://example.com/paper</p>');
  });
  it('links a marker only where the comment defines one, and never to a scheme it rejects', () => {
    expect(parse('<p>See [2] for this</p><p>[1] https://example.com</p>'))
      .toBe('<p>See [2] for this</p><p>[1] https://example.com</p>');
    expect(parse('<p>Trust me [1]</p><p>[1] javascript:alert(1)</p>')).toBe('<p>Trust me [1]</p><p>[1] javascript:alert(1)</p>');
    expect(parse('<pre><code>arr[1]</code></pre><p>[1] https://example.com</p>'))
      .toBe('<pre><code>arr[1]</code></pre><p>[1] https://example.com</p>');
  });
  it('keeps whitespace between inline elements intact', () => {
    expect(parse('<p><i>foo</i> bar <b>baz</b></p>')).toBe('<p><i>foo</i> bar <b>baz</b></p>');
  });
});
