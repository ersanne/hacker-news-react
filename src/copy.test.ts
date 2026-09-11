import { describe, expect, it, vi } from 'vitest';
import { copyText } from './copy';

describe('copying to the clipboard', () => {
  it('reports what happened, so the control that was pressed can say so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('const x = 1')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('const x = 1');
  });
  it('fails quietly where the clipboard is refused, rather than throwing into the render', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    await expect(copyText('anything')).resolves.toBe('failed');
    vi.stubGlobal('navigator', {});
    await expect(copyText('anything')).resolves.toBe('failed');
  });
});
