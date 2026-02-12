import { describe, it, expect } from 'bun:test';
import { parseSingleBlock, parsePorcelainOutput } from './git';

describe('parseSingleBlock', () => {
  it('parses a complete worktree block', () => {
    const block = [
      'worktree /projects/app',
      'HEAD abc123',
      'branch refs/heads/main',
    ].join('\n');

    expect(parseSingleBlock(block)).toEqual({
      path: '/projects/app',
      head: 'abc123',
      branch: 'refs/heads/main',
    });
  });

  it('returns null for block without worktree line', () => {
    expect(parseSingleBlock('HEAD abc123\nbranch refs/heads/main')).toBeNull();
  });

  it('handles block with only worktree line', () => {
    const result = parseSingleBlock('worktree /projects/app');
    expect(result).toEqual({
      path: '/projects/app',
      head: '',
      branch: '',
    });
  });

  it('handles bare worktree (detached HEAD)', () => {
    const block = [
      'worktree /projects/app',
      'HEAD abc123',
      'detached',
    ].join('\n');

    const result = parseSingleBlock(block);
    expect(result).toEqual({
      path: '/projects/app',
      head: 'abc123',
      branch: '',
    });
  });
});

describe('parsePorcelainOutput', () => {
  it('parses multiple worktree blocks', () => {
    const output = [
      'worktree /projects/app',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree /projects/app/.trees/feat',
      'HEAD def456',
      'branch refs/heads/feature/feat',
    ].join('\n');

    const result = parsePorcelainOutput(output);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('/projects/app');
    expect(result[1].path).toBe('/projects/app/.trees/feat');
  });

  it('returns empty array for empty output', () => {
    expect(parsePorcelainOutput('')).toEqual([]);
  });

  it('skips blocks without worktree line', () => {
    const output = [
      'worktree /projects/app',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'HEAD orphan',
      'detached',
    ].join('\n');

    const result = parsePorcelainOutput(output);
    expect(result).toHaveLength(1);
  });
});
