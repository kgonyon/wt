import { defineCommand } from 'citty';
import consola from 'consola';
import { join } from 'path';
import { getProjectRoot, getWorktreePath } from '../lib/paths';
import { loadConfig } from '../lib/config';
import { loadPortAllocations, getPortsForFeature } from '../lib/ports';
import { startService, runServiceHooks, setupShutdownHandler } from '../lib/process';
import { detectFeatureFromCwd } from '../lib/detect';

export default defineCommand({
  meta: {
    name: 'dev',
    description: 'Start dev servers for a feature worktree',
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
    const ports = lookupPorts(root, feature, config.ports);

    consola.start(`Starting dev servers for: ${feature}`);
    consola.info(`Ports: ${ports.join(', ')}`);

    const treePath = getWorktreePath(root, config.worktrees.dir, feature);
    const logsDir = join(root, config.logs.dir, feature);

    await runAllPreHooks(treePath, config.services);
    const processes = startAllServices(treePath, config.services, logsDir);

    setupShutdownHandler(processes, logsDir);
    consola.success('All services running. Press Ctrl+C to stop.');

    await Promise.all(processes.map((p) => p.proc.exited));
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

function lookupPorts(root: string, feature: string, portsConfig: any): number[] {
  const allocations = loadPortAllocations(root);
  const allocation = allocations.features[feature];

  if (!allocation) {
    throw new Error(`No ports allocated for feature "${feature}". Run "wt up ${feature}" first.`);
  }

  return getPortsForFeature(portsConfig, allocation.index);
}

async function runAllPreHooks(treePath: string, services: any[]): Promise<void> {
  for (const service of services) {
    await runServiceHooks(treePath, service);
  }
}

function startAllServices(treePath: string, services: any[], logsDir: string) {
  return services.map((service) => startService(treePath, service, logsDir));
}
