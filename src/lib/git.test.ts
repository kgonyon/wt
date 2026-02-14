import { describe, it, expect, mock } from 'bun:test';

/**
 * Mock handler for gitExec from ./shell.
 * Each getWorktreeStats test sets this to control shell command responses.
 */
type GitExecHandler = (root: string, args: string) => Promise<string>;
let gitExecHandler: GitExecHandler = () =>
  Promise.reject(new Error('no handler configured'));

mock.module('./shell', () => ({
  gitExec: (root: string, args: string) => gitExecHandler(root, args),
}));

import {
  parseSingleBlock,
  parsePorcelainOutput,
  parsePorcelainFileCount,
  parseNumstatOutput,
  getWorktreeStats,
} from './git';

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

describe('parsePorcelainFileCount', () => {
  it('returns 0 for empty string', () => {
    expect(parsePorcelainFileCount('')).toBe(0);
  });

  it('returns 0 for whitespace-only output', () => {
    expect(parsePorcelainFileCount('   \n  \n  ')).toBe(0);
  });

  it('counts a single modified file', () => {
    expect(parsePorcelainFileCount(' M file.ts')).toBe(1);
  });

  it('counts a single added file', () => {
    expect(parsePorcelainFileCount('A  file.ts')).toBe(1);
  });

  it('counts a single deleted file', () => {
    expect(parsePorcelainFileCount(' D file.ts')).toBe(1);
  });

  it('counts a renamed file', () => {
    expect(parsePorcelainFileCount('R  old.ts -> new.ts')).toBe(1);
  });

  it('counts untracked files', () => {
    expect(parsePorcelainFileCount('?? file.ts')).toBe(1);
  });

  it('counts mixed tracked and untracked files correctly', () => {
    const output = [
      ' M src/lib/git.ts',
      '?? src/new-file.ts',
      'A  src/added.ts',
    ].join('\n');
    expect(parsePorcelainFileCount(output)).toBe(3);
  });

  it('handles staged and unstaged changes to the same file as one file', () => {
    expect(parsePorcelainFileCount('MM file.ts')).toBe(1);
  });

  it('handles all two-character XY status codes', () => {
    const output = [
      'AM staged-then-modified.ts',
      'AD staged-then-deleted.ts',
      'UU merge-conflict.ts',
    ].join('\n');
    expect(parsePorcelainFileCount(output)).toBe(3);
  });

  it('counts multiple untracked files correctly', () => {
    const output = [
      '?? file1.ts',
      '?? file2.ts',
      '?? dir/file3.ts',
    ].join('\n');
    expect(parsePorcelainFileCount(output)).toBe(3);
  });

  it('ignores ignored files', () => {
    const output = [
      ' M tracked.ts',
      '!! ignored.ts',
      '?? untracked.ts',
      '!! also-ignored.log',
    ].join('\n');
    expect(parsePorcelainFileCount(output)).toBe(2);
  });
});

describe('parseNumstatOutput', () => {
  it('returns zeros for empty string', () => {
    expect(parseNumstatOutput('')).toEqual({ insertions: 0, deletions: 0 });
  });

  it('returns zeros for whitespace-only output', () => {
    expect(parseNumstatOutput('   \n  \n  ')).toEqual({ insertions: 0, deletions: 0 });
  });

  it('sums insertions and deletions for a single file', () => {
    expect(parseNumstatOutput('10\t5\tfile.ts')).toEqual({
      insertions: 10,
      deletions: 5,
    });
  });

  it('sums across multiple files', () => {
    const output = ['10\t5\tfile1.ts', '3\t7\tfile2.ts'].join('\n');
    expect(parseNumstatOutput(output)).toEqual({
      insertions: 13,
      deletions: 12,
    });
  });

  it('skips binary files shown as dashes', () => {
    expect(parseNumstatOutput('-\t-\timage.png')).toEqual({
      insertions: 0,
      deletions: 0,
    });
  });

  it('handles mix of binary and text files', () => {
    const output = [
      '10\t5\tfile.ts',
      '-\t-\timage.png',
      '3\t2\tother.ts',
    ].join('\n');
    expect(parseNumstatOutput(output)).toEqual({
      insertions: 13,
      deletions: 7,
    });
  });

  it('handles file with zero insertions', () => {
    expect(parseNumstatOutput('0\t5\tfile.ts')).toEqual({
      insertions: 0,
      deletions: 5,
    });
  });

  it('handles file with zero deletions', () => {
    expect(parseNumstatOutput('10\t0\tfile.ts')).toEqual({
      insertions: 10,
      deletions: 0,
    });
  });

  it('handles large numbers', () => {
    expect(parseNumstatOutput('10000\t50000\tfile.ts')).toEqual({
      insertions: 10000,
      deletions: 50000,
    });
  });

  it('skips lines with malformed non-numeric values', () => {
    const output = [
      '10\t5\tfile.ts',
      'abc\t2\tmalformed.ts',
      '3\txyz\talso-malformed.ts',
      '7\t1\tgood.ts',
    ].join('\n');
    expect(parseNumstatOutput(output)).toEqual({
      insertions: 17,
      deletions: 6,
    });
  });

  it('skips lines where both fields are malformed', () => {
    expect(parseNumstatOutput('foo\tbar\tbad.ts')).toEqual({
      insertions: 0,
      deletions: 0,
    });
  });
});

describe('getWorktreeStats', () => {
  it('returns clean stats when git status --porcelain fails', async () => {
    gitExecHandler = () => Promise.reject(new Error('git status failed'));

    const stats = await getWorktreeStats('/fake/path');

    expect(stats).toEqual({
      fileCount: 0,
      insertions: 0,
      deletions: 0,
      isDirty: false,
    });
  });

  it('returns file count with zero line counts when git diff fails', async () => {
    gitExecHandler = (_root: string, args: string) => {
      if (args.includes('diff HEAD --numstat')) {
        return Promise.reject(new Error('git diff failed'));
      }
      return Promise.resolve(' M file.ts\n?? new.ts');
    };

    const stats = await getWorktreeStats('/fake/path');

    expect(stats).toEqual({
      fileCount: 2,
      insertions: 0,
      deletions: 0,
      isDirty: true,
    });
  });

  it('returns full stats when both commands succeed', async () => {
    gitExecHandler = (_root: string, args: string) => {
      if (args.includes('diff HEAD --numstat')) {
        return Promise.resolve('10\t5\tsrc/lib/git.ts\n20\t3\tsrc/new.ts');
      }
      return Promise.resolve(' M src/lib/git.ts\n?? src/new.ts\nA  added.ts');
    };

    const stats = await getWorktreeStats('/fake/path');

    expect(stats).toEqual({
      fileCount: 3,
      insertions: 30,
      deletions: 8,
      isDirty: true,
    });
  });
});
