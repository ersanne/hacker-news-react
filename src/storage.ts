import { useCallback, useState, useSyncExternalStore } from 'react';

export function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Reading works without storage. */ }
}

const LIMIT = 2000;
function load(key: string) {
  try {
    const values: unknown = JSON.parse(readStorage(key) ?? '[]');
    return new Set(Array.isArray(values) ? values.filter(v => Number.isSafeInteger(v) && v > 0).slice(-LIMIT) : []);
  } catch { return new Set<number>(); }
}
// Ids are stored oldest-first so the cap drops the least recently touched.
function apply(key: string, previous: Set<number>, id: number, present: boolean) {
  const values = [...previous].filter(value => value !== id);
  const next = new Set(present ? [...values, id].slice(-LIMIT) : values);
  writeStorage(key, JSON.stringify([...next]));
  return next;
}

function useIdSet(key: string) {
  const [ids, setIds] = useState<Set<number>>(() => load(key));
  const add = useCallback((id: number) => setIds(previous => apply(key, previous, id, true)), [key]);
  const toggle = useCallback((id: number) => setIds(previous => apply(key, previous, id, !previous.has(id))), [key]);
  return { ids, add, toggle };
}

export function useReadStories() {
  const { ids, add } = useIdSet('hn-read');
  return { read: ids, markRead: add };
}
export function useSavedStories() {
  const { ids, toggle } = useIdSet('hn-saved');
  return { saved: ids, toggleSaved: toggle };
}

export type Flag = { get: () => boolean; set: (on: boolean) => void; subscribe: (listen: () => void) => () => void };

// A preference every instance of a control shares, so turning one on turns
// them all on rather than leaving the page half in each state.
export function flag(key: string, fallback: boolean): Flag {
  const listeners = new Set<() => void>();
  const stored = readStorage(key);
  let on = stored === null ? fallback : stored === '1';
  return {
    get: () => on,
    set: next => { on = next; writeStorage(key, next ? '1' : '0'); for (const listen of listeners) listen(); },
    subscribe: listen => { listeners.add(listen); return () => listeners.delete(listen); },
  };
}
export function useFlag(store: Flag) {
  return useSyncExternalStore(store.subscribe, store.get);
}
