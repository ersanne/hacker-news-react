import { createContext, useContext } from 'react';
import type { Comment } from './api';
import { plainText } from './richtext';

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

// Past this depth the thread stops indenting, so opening a reply there is
// where a reader most needs to have chosen to.
export const FLAT_DEPTH = 3;
// A subtree this small unfurls entirely in one go, because a comment with no
// more than three below it has children with no more than two.
const AUTO_OPEN = 3;

// What a click costs is the screen the whole subtree takes, not the number of
// replies directly under the comment.
export function opensByDefault(entry?: ThreadEntry) {
  return !!entry && entry.total > 0 && entry.total <= AUTO_OPEN && entry.depth < FLAT_DEPTH;
}

// Long enough to recognise which comment is meant, short enough to stay one
// line above the replies it introduces.
export function excerpt(text: string, limit = 90) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// A short query matches most of a long thread and says nothing about it.
export const MIN_QUERY = 2;
// Decoding a comment costs a sanitising pass, so what a comment says is worked
// out the first time it is searched for and kept against the comment itself.
const said = new WeakMap<Comment, string>();
function says(comment: Comment) {
  let value = said.get(comment);
  if (value === undefined) said.set(comment, value = plainText(comment.text ?? '').toLowerCase());
  return value;
}

// Only twenty comments are laid out and a collapsed reply is not built at all,
// so matches are found in the thread as it arrived rather than on the page.
export function findMatches(roots: Comment[], query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY) return [];
  const found: number[] = [];
  function walk(comment: Comment) {
    // Readers look for who said something as often as for what was said.
    if (says(comment).includes(needle) || (comment.by ?? '').toLowerCase().includes(needle)) found.push(comment.id);
    for (const kid of comment.kids) walk(kid);
  }
  for (const root of roots) walk(root);
  return found;
}

// Folding the whole conversation remounts the tree, so each comment reads its
// starting state from here rather than being told to change.
export type Thread = {
  index: ThreadIndex; author?: string; folded?: boolean; unfolded?: boolean;
  // What the reader is looking for, which comments hold it, and the path down
  // to the one they are on — the only comments a find opens.
  query?: string; matched?: Set<number>; path?: Set<number>; current?: number;
};
const ThreadContext = createContext<Thread>({ index: new Map() });
export const ThreadProvider = ThreadContext.Provider;
export function useThread() { return useContext(ThreadContext); }
