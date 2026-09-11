import { describe, expect, it } from 'vitest';
import { ancestorsOf, indexThread } from './thread';
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
  it('reads an empty discussion as an empty index', () => {
    expect(indexThread([]).size).toBe(0);
  });
});
