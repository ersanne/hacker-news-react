import { describe, expect, it } from 'vitest';
import { ancestorsOf, excerpt, findMatches, indexThread, opensByDefault } from './thread';
import type { Comment } from './api';

const comment = (id: number, kids: Comment[] = [], by = `user${id}`): Comment =>
  ({ id, by, text: `Comment ${id}`, time: 0, removed: false, kids });

describe('a discussion as a tree', () => {
  it('counts everything under a comment, not the replies directly beneath it', () => {
    const roots = [comment(1, [comment(2, [comment(3), comment(4)]), comment(5)]), comment(6)];
    const index = indexThread(roots);
    expect(index.get(1)?.total).toBe(4);
    expect(index.get(2)?.total).toBe(2);
    expect(index.get(3)?.total).toBe(0);
    expect(index.get(6)?.total).toBe(0);
  });
  it('counts a removed comment, because its place in the thread is still there', () => {
    const removed: Comment = { id: 2, removed: true, kids: [comment(3)] };
    expect(indexThread([comment(1, [removed])]).get(1)?.total).toBe(2);
  });
  it('knows how deep a comment sits and what it hangs from', () => {
    const index = indexThread([comment(1, [comment(2, [comment(3)])])]);
    expect(index.get(3)?.depth).toBe(2);
    expect(index.get(3)?.parent?.id).toBe(2);
    expect(index.get(1)?.parent).toBeNull();
    expect(ancestorsOf(index, 3)).toEqual([1, 2]);
    expect(ancestorsOf(index, 1)).toEqual([]);
    expect(ancestorsOf(index, 99)).toEqual([]);
  });
  it('opens a subtree small enough to unfurl in one go, and leaves the rest', () => {
    const index = indexThread([comment(1, [comment(2), comment(3), comment(4)]), comment(5, [comment(6), comment(7), comment(8), comment(9)])]);
    expect(opensByDefault(index.get(1))).toBe(true);
    expect(opensByDefault(index.get(5))).toBe(false);
    // Nothing to open, and nothing known about it.
    expect(opensByDefault(index.get(2))).toBe(false);
    expect(opensByDefault(undefined)).toBe(false);
  });
  it('leaves a reply below the flattening depth to be opened deliberately', () => {
    const index = indexThread([comment(1, [comment(2, [comment(3, [comment(4, [comment(5)])])])])]);
    expect(index.get(4)?.depth).toBe(3);
    expect(opensByDefault(index.get(4))).toBe(false);
  });
  it('cuts an excerpt on a word, and leaves short text whole', () => {
    expect(excerpt('short enough', 20)).toBe('short enough');
    expect(excerpt('a sentence that runs past the limit given', 20)).toBe('a sentence that…');
    // No word boundary worth cutting on, so the cut falls where it must.
    expect(excerpt('supercalifragilistic', 10)).toBe('supercalif…');
  });
  it('reads an empty discussion as an empty index', () => {
    expect(indexThread([]).size).toBe(0);
  });
});

describe('finding a comment in a discussion', () => {
  it('returns matches in the order they are shown, from the thread rather than the page', () => {
    const roots = [comment(1, [comment(2, [comment(3)])], 'ada'), comment(4, [], 'bob')];
    roots[0].kids[0].text = '<p>Nothing here</p>';
    expect(findMatches(roots, 'comment')).toEqual([1, 3, 4]);
  });
  it('matches the author as well as what they said', () => {
    expect(findMatches([comment(1, [], 'ada'), comment(2, [], 'bob')], 'ada')).toEqual([1]);
  });
  it('ignores case, and a query too short to mean anything', () => {
    const roots = [comment(1, [], 'ada')];
    roots[0].text = '<p>Craftsmanship</p>';
    expect(findMatches(roots, 'CRAFT')).toEqual([1]);
    expect(findMatches(roots, 'c')).toEqual([]);
    expect(findMatches(roots, '  ')).toEqual([]);
  });
  it('reads a comment as its text, so markup neither matches nor hides a match', () => {
    const roots = [comment(1)];
    roots[0].text = '<p>a <em>craft</em> worth learning</p>';
    expect(findMatches(roots, 'em')).toEqual([]);
    expect(findMatches(roots, 'craft')).toEqual([1]);
    // A match split by markup is still counted, though it cannot be marked.
    roots[0].text = '<p>cra<em>ft</em></p>';
    expect(findMatches(roots, 'craft')).toEqual([1]);
  });
  it('finds nothing in a removed comment, which has nothing to say', () => {
    const removed: Comment = { id: 2, removed: true, kids: [] };
    expect(findMatches([removed], 'anything')).toEqual([]);
  });
});
