import { describe, it, expect } from 'bun:test';
import { findCommand } from './run';
import type { WtConfig } from '../types/config';

function makeConfig(commands?: WtConfig['commands']): WtConfig {
  const config: WtConfig = {
    name: 'test-project',
    worktrees: { dir: '.trees', branch_prefix: 'feature/' },
    port: { base: 3000, per_feature: 10, max: 100 },
  };
  if (commands !== undefined) {
    config.commands = commands;
  }
  return config;
}

describe('findCommand', () => {
  it('returns the matching command config', () => {
    const config = makeConfig([
      { name: 'dev', command: 'npm run dev' },
      { name: 'build', command: 'npm run build' },
    ]);
    const result = findCommand(config, 'dev');
    expect(result).toEqual({ name: 'dev', command: 'npm run dev' });
  });

  it('throws for unknown command with available list', () => {
    const config = makeConfig([
      { name: 'dev', command: 'npm run dev' },
      { name: 'build', command: 'npm run build' },
    ]);
    expect(() => findCommand(config, 'test')).toThrow('Unknown command "test"');
    expect(() => findCommand(config, 'test')).toThrow('Available: dev, build');
  });

  it('throws with "none" when commands is undefined', () => {
    const config = makeConfig(undefined);
    expect(() => findCommand(config, 'dev')).toThrow('Available: none');
  });

  it('throws for empty commands array', () => {
    const config = makeConfig([]);
    expect(() => findCommand(config, 'dev')).toThrow('Unknown command "dev"');
  });
});
