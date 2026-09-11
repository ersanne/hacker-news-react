import { describe, expect, it } from 'vitest';
import { archiveUrl, domain, plainTitle, readingTime, safeUrl, sanitize, sanitizeArticle } from './format';

describe('untrusted HN content', () => {
  it('preserves readable formatting while stripping scripts, handlers, and unsafe links', () => {
    const html = sanitize('<p>Hello <em>world</em><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a><a href="https://example.com" onclick="alert(1)">good</a></p><pre><code>const x = 1</code></pre>');
    expect(html).toContain('<em>world</em>');
    expect(html).toContain('<pre><code>const x = 1</code></pre>');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toMatch(/script|onerror|onclick|<img/);
  });
  it('accepts only absolute HTTP or HTTPS article links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,hello')).toBeUndefined();
    expect(safeUrl('/relative')).toBeUndefined();
    expect(domain('https://www.example.com/path')).toBe('example.com');
  });
  it('decodes entities into plain text without interpreting markup', () => {
    expect(plainTitle('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3');
  });
  it('keeps article structure while still stripping scripts and handlers', () => {
    const html = sanitizeArticle('<h2>Heading</h2><p>Body</p><img src="https://example.com/a.png" alt="A"><table><tr><td>Cell</td></tr></table><script>alert(1)</script><p onmouseover="alert(1)">Hover</p>');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<img src="https://example.com/a.png" alt="A">');
    expect(html).toContain('<td>Cell</td>');
    expect(html).not.toMatch(/script|onmouseover/);
  });
  it('estimates reading time from the word count, never below a minute', () => {
    expect(readingTime('word '.repeat(440))).toBe('2 min read');
    expect(readingTime('short')).toBe('1 min read');
  });
  it('points archive links at the newest snapshot of the article', () => {
    expect(archiveUrl('https://example.com/a?b=c')).toBe('https://archive.is/newest/https://example.com/a?b=c');
  });
});
