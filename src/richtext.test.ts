import { describe, expect, it } from 'vitest';
import { parseComment, type RichNode } from './richtext';

// The tree renders through React, so assertions read it back as the markup it
// stands for rather than walking nested objects.
function html(nodes: RichNode[]): string {
  return nodes.map(node => {
    if (typeof node === 'string') return node;
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
    expect(tags(parseComment(nasty)).filter(tag => !['p', 'a', 'em', 'i', 'strong', 'b', 'code', 'pre', 'blockquote', 'br', 'ul', 'ol', 'li'].includes(tag))).toEqual([]);
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
  it('keeps whitespace between inline elements intact', () => {
    expect(parse('<p><i>foo</i> bar <b>baz</b></p>')).toBe('<p><i>foo</i> bar <b>baz</b></p>');
  });
});
