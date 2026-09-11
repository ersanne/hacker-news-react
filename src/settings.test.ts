import { describe, expect, it } from 'vitest';
import { defaults, parseSettings } from './settings';

describe('stored view settings', () => {
  it('falls back to the defaults when nothing readable is stored', () => {
    for (const raw of [null, '', 'not json', '[]', 'null', '"wide"', '7']) {
      expect(parseSettings(raw)).toEqual(defaults);
    }
  });
  it('keeps the values it recognises and replaces the ones it does not', () => {
    const settings = parseSettings(JSON.stringify({
      width: 'full', order: 'sideways', density: 'compact', heading: 'yes', refresh: 7,
    }));
    expect(settings).toEqual({ ...defaults, width: 'full', density: 'compact' });
  });
  it('reads a full set back unchanged', () => {
    const stored = { width: 'wide', order: 'article-first', density: 'compact', heading: false, refresh: 15 } as const;
    expect(parseSettings(JSON.stringify(stored))).toEqual(stored);
  });
  it('rejects a refresh interval that arrives as a string', () => {
    expect(parseSettings('{"refresh":"5"}').refresh).toBe(0);
  });
});
