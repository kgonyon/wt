import { describe, it, expect } from 'bun:test';
import { filterFeatureWorktrees, formatStats } from './status';
import type { WorktreeInfo, WorktreeStats } from '../lib/git';

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

describe('formatStats', () => {
  it('returns clean when isDirty is false', () => {
    const stats: WorktreeStats = { fileCount: 0, insertions: 0, deletions: 0, isDirty: false };
    expect(formatStats(stats)).toBe('clean');
  });

  it('returns clean for zero file count with zero changes', () => {
    const stats: WorktreeStats = { fileCount: 0, insertions: 0, deletions: 0, isDirty: true };
    expect(formatStats(stats)).toBe('clean');
  });

  it('returns formatted string for dirty worktree', () => {
    const stats: WorktreeStats = { fileCount: 3, insertions: 10, deletions: 5, isDirty: true };
    expect(formatStats(stats)).toBe('3 changed  +10 -5');
  });

  it('formats single file with only insertions', () => {
    const stats: WorktreeStats = { fileCount: 1, insertions: 7, deletions: 0, isDirty: true };
    expect(formatStats(stats)).toBe('1 changed  +7 -0');
  });

  it('formats single file with only deletions', () => {
    const stats: WorktreeStats = { fileCount: 1, insertions: 0, deletions: 12, isDirty: true };
    expect(formatStats(stats)).toBe('1 changed  +0 -12');
  });

  it('formats untracked-only changes with zero line counts', () => {
    const stats: WorktreeStats = { fileCount: 2, insertions: 0, deletions: 0, isDirty: true };
    expect(formatStats(stats)).toBe('2 changed  +0 -0');
  });

  it('never returns "0 changed  +0 -0"', () => {
    const stats: WorktreeStats = { fileCount: 0, insertions: 0, deletions: 0, isDirty: true };
    expect(formatStats(stats)).not.toBe('0 changed  +0 -0');
    expect(formatStats(stats)).toBe('clean');
  });

  it('formats large numbers correctly', () => {
    const stats: WorktreeStats = { fileCount: 150, insertions: 10000, deletions: 5432, isDirty: true };
    expect(formatStats(stats)).toBe('150 changed  +10000 -5432');
  });

  it('uses double-space separator between changed and counts', () => {
    const stats: WorktreeStats = { fileCount: 3, insertions: 10, deletions: 5, isDirty: true };
    const result = formatStats(stats);
    expect(result).toContain('changed  +');
    expect(result).not.toContain('changed +');
    // Verify exactly two spaces
    const match = result.match(/changed( +)\+/);
    expect(match?.[1]).toBe('  ');
  });
});
