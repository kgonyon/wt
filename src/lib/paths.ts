import { $ } from 'bun';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

export async function getGitRoot(): Promise<string> {
  const result = await $`git rev-parse --show-toplevel`.quiet();
  return result.text().trim();
}

export async function getProjectRoot(): Promise<string> {
  const gitRoot = await getGitRoot();
  const configPath = join(gitRoot, '.wt', 'config.yaml');

  if (!existsSync(configPath)) {
    throw new Error(`No .wt/config.yaml found at ${gitRoot}`);
  }

  return gitRoot;
}

export function getWorktreePath(root: string, dir: string, feature: string): string {
  return join(root, dir, feature);
}

export function getConfigPath(root: string): string {
  return join(root, '.wt', 'config.yaml');
}

export function getLocalConfigPath(root: string): string {
  return join(root, '.wt', 'local.yaml');
}

export function getPortAllocationsPath(root: string): string {
  return join(root, '.wt', 'port_allocations.json');
}

export function getUserConfigPath(): string {
  return join(homedir(), '.config', 'wt', 'config.yaml');
}
