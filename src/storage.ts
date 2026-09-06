import { useCallback, useState } from 'react';

export function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writeStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Reading works without storage. */ }
}
export function useReadStories() {
  const [read, setRead] = useState<Set<number>>(() => {
    try {
      const values: unknown = JSON.parse(readStorage('hn-read') ?? '[]');
      return new Set(Array.isArray(values) ? values.filter(v => Number.isSafeInteger(v) && v > 0).slice(-2000) : []);
    } catch { return new Set(); }
  });
  const markRead = useCallback((id: number) => {
    setRead(previous => {
      const values = [...previous].filter(value => value !== id);
      const next = new Set([...values, id].slice(-2000));
      writeStorage('hn-read', JSON.stringify([...next]));
      return next;
    });
  }, []);
  return { read, markRead };
}
