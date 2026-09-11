import { createContext, useContext } from 'react';
import type { Comment } from './api';

export type ThreadEntry = { comment: Comment; parent: Comment | null; depth: number; total: number };
export type ThreadIndex = Map<number, ThreadEntry>;

// The whole discussion arrives in one response, so it is walked once and every
// question about a comment's place in it is answered from the result.
export function indexThread(roots: Comment[]): ThreadIndex {
  const index: ThreadIndex = new Map();
  function walk(comment: Comment, parent: Comment | null, depth: number): number {
    const total = comment.kids.reduce((sum, kid) => sum + walk(kid, comment, depth + 1), 0);
    index.set(comment.id, { comment, parent, depth, total });
    return total + 1;
  }
  for (const root of roots) walk(root, null, 0);
  return index;
}

// Outermost first, so a caller can open a path from the top down.
export function ancestorsOf(index: ThreadIndex, id: number): number[] {
  const path: number[] = [];
  for (let parent = index.get(id)?.parent; parent; parent = index.get(parent.id)?.parent) path.unshift(parent.id);
  return path;
}

export type Thread = { index: ThreadIndex; author?: string };
const ThreadContext = createContext<Thread>({ index: new Map() });
export const ThreadProvider = ThreadContext.Provider;
export function useThread() { return useContext(ThreadContext); }
