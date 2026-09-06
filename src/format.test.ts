import { describe, expect, it } from 'vitest';
import { domain, plainTitle, safeUrl, sanitize } from './format';

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
});
