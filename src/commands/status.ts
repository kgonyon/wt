import { defineCommand } from 'citty';
import consola from 'consola';
import { basename } from 'path';
import { getProjectRoot } from '../lib/paths';
import { loadConfig } from '../lib/config';
import { loadPortAllocations, getPortsForFeature } from '../lib/ports';
import { listWorktrees, isWorktreeDirty } from '../lib/git';
import type { WorktreeInfo } from '../lib/git';
import type { PortAllocations, WtConfig } from '../types/config';

export default defineCommand({
  meta: {
    name: 'status',
    description: 'Show all active feature worktrees with branch, port, and dirty state',
  },
  async run() {
    const root = await getProjectRoot();
    const config = loadConfig(root);
    const allocations = loadPortAllocations(root);
    const worktrees = await listWorktrees(root);
    const treesDir = config.worktrees.dir.replace(/\/$/, '');

    const features = filterFeatureWorktrees(worktrees, treesDir);

    if (features.length === 0) {
      consola.info('No active feature worktrees');
      return;
    }

    consola.info(`Active features (${features.length}):\n`);

    for (const wt of features) {
      await printFeatureStatus(wt, allocations, config);
    }
  },
});

function filterFeatureWorktrees(worktrees: WorktreeInfo[], treesDir: string): WorktreeInfo[] {
  return worktrees.filter((wt) => wt.path.includes(`/${treesDir}/`));
}

async function printFeatureStatus(
  wt: WorktreeInfo,
  allocations: PortAllocations,
  config: WtConfig,
): Promise<void> {
  const feature = basename(wt.path);
  const allocation = allocations.features[feature];
  const ports = allocation
    ? getPortsForFeature(config.port, allocation.index)
    : [];
  const dirty = await isWorktreeDirty(wt.path);

  const branchName = wt.branch.replace('refs/heads/', '');
  const portStr = ports.length > 0 ? ports.join(', ') : 'unallocated';

  console.log(`  ${feature}`);
  console.log(`    Branch: ${branchName}`);
  console.log(`    Ports:  ${portStr}`);
  console.log(`    Status: ${dirty ? 'dirty' : 'clean'}`);
  console.log('');
}
