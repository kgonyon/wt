import { defineCommand } from 'citty';
import consola from 'consola';
import { getProjectRoot, getWorktreePath } from '../lib/paths';
import { loadConfig } from '../lib/config';
import { allocatePorts, getPortsForFeature } from '../lib/ports';
import { addWorktree } from '../lib/git';
import { generateEnvFiles } from '../lib/env';
import { runHook } from '../lib/process';

export default defineCommand({
  meta: {
    name: 'up',
    description: 'Create a new feature worktree with port allocation and env setup',
  },
  args: {
    feature: {
      type: 'positional',
      description: 'Feature name for the worktree',
      required: true,
    },
  },
  async run({ args }) {
    const feature = args.feature;
    const root = await getProjectRoot();
    const config = loadConfig(root);

    consola.start(`Setting up feature: ${feature}`);

    const index = allocatePorts(root, feature, config.ports);
    const ports = getPortsForFeature(config.ports, index);
    consola.info(`Allocated ports: ${ports.join(', ')}`);

    const treePath = getWorktreePath(root, config.worktrees.dir, feature);
    await addWorktree(root, treePath, config.worktrees.branch_prefix, feature);
    consola.info(`Created worktree at ${treePath}`);

    generateEnvFiles(treePath, config.packages, ports);
    consola.info('Generated env files');

    await runSetupHooks(treePath, config.setup.hooks);

    printSummary(feature, config.worktrees.branch_prefix, ports, treePath);
  },
});

async function runSetupHooks(treePath: string, hooks: string[]): Promise<void> {
  for (const hook of hooks) {
    consola.info(`Running setup hook: ${hook}`);
    await runHook(treePath, hook);
  }
}

function printSummary(
  feature: string,
  branchPrefix: string,
  ports: number[],
  treePath: string,
): void {
  consola.success(`Feature "${feature}" is ready!`);
  consola.box(
    [
      `Feature:  ${feature}`,
      `Branch:   ${branchPrefix}${feature}`,
      `Ports:    ${ports.join(', ')}`,
      `Path:     ${treePath}`,
    ].join('\n'),
  );
}
