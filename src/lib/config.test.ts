import { describe, it, expect } from 'bun:test';
import { isPlainObject, deepMerge } from './config';

describe('isPlainObject', () => {
  it('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject('string')).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('deep merges nested objects', () => {
    const target = { port: { base: 3000, per_feature: 10 } };
    const source = { port: { base: 4000 } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ port: { base: 4000, per_feature: 10 } });
  });

  it('overwrites arrays (no array merging)', () => {
    const target = { commands: [{ name: 'dev' }] };
    const source = { commands: [{ name: 'build' }] };
    const result = deepMerge(target, source);
    expect(result).toEqual({ commands: [{ name: 'build' }] });
  });

  it('does not mutate target', () => {
    const target = { a: 1, nested: { b: 2 } };
    const source = { nested: { c: 3 } };
    const result = deepMerge(target, source);
    expect(target.nested).toEqual({ b: 2 });
    expect(result.nested).toEqual({ b: 2, c: 3 });
  });

  it('handles empty source', () => {
    const target = { a: 1 };
    expect(deepMerge(target, {})).toEqual({ a: 1 });
  });

  it('handles empty target', () => {
    const source = { a: 1 };
    expect(deepMerge({}, source)).toEqual({ a: 1 });
  });

  it('overwrites primitives with objects', () => {
    const result = deepMerge({ a: 'string' }, { a: { nested: true } });
    expect(result).toEqual({ a: { nested: true } });
  });

  it('overwrites objects with primitives', () => {
    const result = deepMerge({ a: { nested: true } }, { a: 'string' });
    expect(result).toEqual({ a: 'string' });
  });
});
