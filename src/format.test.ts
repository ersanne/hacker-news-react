import { describe, expect, it } from 'vitest';
import { archiveUrl, domain, plainTitle, readingTime, safeUrl, sanitizeArticle, shareUrl } from './format';

describe('untrusted HN content', () => {
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
  it('shares an absolute reader link to the story alone', () => {
    expect(shareUrl(42)).toBe(`${window.location.origin}/item?id=42`);
  });
  it('points archive links at the newest snapshot of the article', () => {
    expect(archiveUrl('https://example.com/a?b=c')).toBe('https://archive.is/newest/https://example.com/a?b=c');
  });
});
