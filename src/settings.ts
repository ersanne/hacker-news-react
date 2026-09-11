import { createContext, useCallback, useContext, useState } from 'react';
import { readStorage, writeStorage } from './storage';

export type Settings = {
  width: 'comfortable' | 'wide' | 'full';
  order: 'comments-first' | 'article-first';
  density: 'comfortable' | 'compact';
  heading: boolean;
  refresh: 0 | 1 | 5 | 15;
};

const KEY = 'hn-view';
const choices = {
  width: ['comfortable', 'wide', 'full'],
  order: ['comments-first', 'article-first'],
  density: ['comfortable', 'compact'],
  refresh: [0, 1, 5, 15],
} as const;

export const defaults: Settings = {
  width: 'comfortable',
  order: 'comments-first',
  density: 'comfortable',
  heading: true,
  refresh: 0,
};

// Every field is validated on its own so one unknown value falls back to its
// default instead of discarding the whole set.
export function parseSettings(raw: string | null): Settings {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) stored = value as Record<string, unknown>;
  } catch { /* A damaged value reads as no preferences at all. */ }
  function pick<K extends keyof typeof choices>(key: K): Settings[K] {
    const allowed: readonly unknown[] = choices[key];
    return allowed.includes(stored[key]) ? stored[key] as Settings[K] : defaults[key];
  }
  return {
    width: pick('width'),
    order: pick('order'),
    density: pick('density'),
    heading: typeof stored.heading === 'boolean' ? stored.heading : defaults.heading,
    refresh: pick('refresh'),
  };
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(() => parseSettings(readStorage(KEY)));
  const update = useCallback((patch: Partial<Settings>) => setSettings(previous => {
    const next = { ...previous, ...patch };
    writeStorage(KEY, JSON.stringify(next));
    return next;
  }), []);
  return [settings, update];
}

const SettingsContext = createContext<Settings>(defaults);
export const SettingsProvider = SettingsContext.Provider;
export function useViewSettings() { return useContext(SettingsContext); }
