import { defineCommand } from 'citty';
import consola from 'consola';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { getProjectRoot, getWorktreePath } from '../lib/paths';
import { loadConfig } from '../lib/config';
import { deallocatePorts } from '../lib/ports';
import { removeWorktree } from '../lib/git';
import { detectFeatureFromCwd } from '../lib/detect';

export default defineCommand({
  meta: {
    name: 'down',
    description: 'Remove a feature worktree and deallocate ports',
  },
  args: {
    feature: {
      type: 'positional',
      description: 'Feature name (auto-detected if inside a worktree)',
      required: false,
    },
  },
  async run({ args }) {
    const root = await getProjectRoot();
    const config = loadConfig(root);

    const feature = resolveFeature(args.feature as string | undefined, config.worktrees.dir);
    consola.start(`Tearing down feature: ${feature}`);

    const treePath = getWorktreePath(root, config.worktrees.dir, feature);
    await removeWorktree(root, treePath);
    consola.info('Removed worktree');

    deallocatePorts(root, feature);
    consola.info('Deallocated ports');

    cleanLogs(root, config.logs.dir, feature);

    consola.success(`Feature "${feature}" has been removed`);
  },
});

function resolveFeature(feature: string | undefined, treesDir: string): string {
  if (feature) return feature;

  const detected = detectFeatureFromCwd(process.cwd(), treesDir);
  if (!detected) {
    throw new Error('Could not detect feature name. Provide it as an argument.');
  }

  return detected;
}

function cleanLogs(root: string, logsDir: string, feature: string): void {
  const logPath = join(root, logsDir, feature);

  if (existsSync(logPath)) {
    rmSync(logPath, { recursive: true });
    consola.info('Cleaned log files');
  }
}
