import { defineCommand } from 'citty';
import consola from 'consola';
import { join } from 'path';
import { getProjectRoot, getWorktreePath, resolveRelativePath } from '../lib/paths';
import { loadConfig } from '../lib/config';
import { loadPortAllocations, getPortsForFeature } from '../lib/ports';
import { resolveFeature } from '../lib/detect';
import { runHooks } from '../lib/hooks';
import { runCommand } from '../lib/script';
import type { ScriptContext } from '../lib/script';
import type { WtConfig, CommandConfig } from '../types/config';

export default defineCommand({
  meta: {
    name: 'run',
    description: 'Run a configured command',
  },
  args: {
    command: {
      type: 'positional',
      description: 'Command name to run',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (auto-detected if inside a worktree)',
      alias: 'f',
    },
  },
  async run({ args }) {
    const root = await getProjectRoot();
    const config = loadConfig(root);
    const cmdConfig = findCommand(config, args.command);
    const scope = cmdConfig.scope ?? 'feature';

    if (scope === 'project') {
      await runProjectScoped(root, config, cmdConfig);
    } else {
      await runFeatureScoped(root, config, cmdConfig, args.feature as string | undefined);
    }
  },
});

async function runFeatureScoped(
  root: string,
  config: WtConfig,
  cmdConfig: CommandConfig,
  featureArg: string | undefined,
): Promise<void> {
  const feature = resolveFeature(featureArg, config.worktrees.dir, cmdConfig.name);
  const treePath = getWorktreePath(root, config.worktrees.dir, feature);
  const ports = lookupPorts(root, feature, config);

  const context: ScriptContext = {
    root,
    feature,
    featureDir: treePath,
    projectName: config.name,
    ports,
    basePort: ports[0] ?? 0,
  };

  const command = resolveRelativePath(cmdConfig.command, join(treePath, '.wt'));

  consola.start(`Running "${cmdConfig.name}" for feature: ${feature}`);
  await runCommand(command, context, treePath);
  await runHooks('run', context);
}

async function runProjectScoped(
  root: string,
  config: WtConfig,
  cmdConfig: CommandConfig,
): Promise<void> {
  const context: ScriptContext = {
    root,
    feature: '',
    featureDir: '',
    projectName: config.name,
    ports: [],
    basePort: 0,
  };

  const command = resolveRelativePath(cmdConfig.command, join(root, '.wt'));

  consola.start(`Running "${cmdConfig.name}"`);
  await runCommand(command, context, root);
  await runHooks('run', context);
}

function findCommand(config: WtConfig, name: string): CommandConfig {
  const cmd = config.commands?.find((c) => c.name === name);

  if (!cmd) {
    const available = config.commands?.map((c) => c.name).join(', ') ?? 'none';
    throw new Error(`Unknown command "${name}". Available: ${available}`);
  }

  return cmd;
}

function lookupPorts(root: string, feature: string, config: WtConfig): number[] {
  const allocations = loadPortAllocations(root);
  const allocation = allocations.features[feature];

  if (!allocation) {
    throw new Error(`No ports allocated for feature "${feature}". Run "wt up ${feature}" first.`);
  }

  return getPortsForFeature(config.port, allocation.index);
}
