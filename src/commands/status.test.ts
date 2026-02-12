import { describe, it, expect } from 'bun:test';
import { filterFeatureWorktrees } from './status';
import type { WorktreeInfo } from '../lib/git';

describe('filterFeatureWorktrees', () => {
  const worktrees: WorktreeInfo[] = [
    { path: '/projects/app', head: 'abc', branch: 'refs/heads/main' },
    { path: '/projects/app/.trees/feat-a', head: 'def', branch: 'refs/heads/feature/feat-a' },
    { path: '/projects/app/.trees/feat-b', head: 'ghi', branch: 'refs/heads/feature/feat-b' },
  ];

  it('returns only worktrees inside trees dir', () => {
    const result = filterFeatureWorktrees(worktrees, '.trees');
    expect(result).toHaveLength(2);
    expect(result[0].path).toContain('feat-a');
    expect(result[1].path).toContain('feat-b');
  });

  it('returns empty array when no features match', () => {
    const result = filterFeatureWorktrees(worktrees, '.worktrees');
    expect(result).toEqual([]);
  });

  it('handles empty worktree list', () => {
    expect(filterFeatureWorktrees([], '.trees')).toEqual([]);
  });
});
