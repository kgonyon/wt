import { describe, it, expect, mock, afterEach } from 'bun:test';
import { detectFeatureFromCwd, resolveFeature } from './detect';

describe('detectFeatureFromCwd', () => {
  it('detects feature when cwd is inside trees dir', () => {
    expect(
      detectFeatureFromCwd('/projects/app/.trees/my-feature', '.trees'),
    ).toBe('my-feature');
  });

  it('detects feature from a nested subdirectory', () => {
    expect(
      detectFeatureFromCwd('/projects/app/.trees/feat/src/lib', '.trees'),
    ).toBe('feat');
  });

  it('returns null when cwd is not inside trees dir', () => {
    expect(detectFeatureFromCwd('/projects/app/src', '.trees')).toBeNull();
  });

  it('returns null when trees dir is at end without feature', () => {
    expect(detectFeatureFromCwd('/projects/app/.trees/', '.trees')).toBeNull();
  });

  it('handles treesDir with trailing slash', () => {
    expect(
      detectFeatureFromCwd('/projects/app/.trees/feat', '.trees/'),
    ).toBe('feat');
  });

  it('handles backslashes in cwd (Windows-style)', () => {
    expect(
      detectFeatureFromCwd('C:\\projects\\app\\.trees\\feat', '.trees'),
    ).toBe('feat');
  });
});

describe('resolveFeature', () => {
  it('returns provided feature directly', () => {
    expect(resolveFeature('my-feature', '.trees')).toBe('my-feature');
  });

  it('throws with command name when no feature and auto-detect fails', () => {
    // process.cwd() won't be inside a trees dir, so auto-detect fails
    expect(() => resolveFeature(undefined, '.trees', 'dev')).toThrow(
      'Command "dev" requires a feature context',
    );
  });

  it('throws generic message when no feature and no command name', () => {
    expect(() => resolveFeature(undefined, '.trees')).toThrow(
      'Could not detect feature name',
    );
  });
});
