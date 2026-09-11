import { describe, expect, it, vi } from 'vitest';
import { flag } from './storage';

describe('a shared preference flag', () => {
  it('starts at its fallback, remembers what it is set to, and tells every reader', () => {
    localStorage.clear();
    const wrap = flag('hn-test-wrap', false);
    expect(wrap.get()).toBe(false);
    const listen = vi.fn();
    const stop = wrap.subscribe(listen);
    wrap.set(true);
    expect(wrap.get()).toBe(true);
    expect(listen).toHaveBeenCalledOnce();
    expect(flag('hn-test-wrap', false).get()).toBe(true);
    stop();
    wrap.set(false);
    expect(listen).toHaveBeenCalledOnce();
  });
  it('reads as its fallback where storage is refused, rather than failing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const wrap = flag('hn-test-wrap', true);
    expect(wrap.get()).toBe(true);
    expect(() => wrap.set(false)).not.toThrow();
    expect(wrap.get()).toBe(false);
  });
});
