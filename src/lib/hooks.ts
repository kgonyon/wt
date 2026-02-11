import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { getConfigPath, getLocalConfigPath, getUserConfigPath } from './paths';
import { runCommand } from './script';
import { HOOK_EVENTS } from '../types/hooks';
import type { HookEvent, HookConfig } from '../types/hooks';
import type { ScriptContext } from './script';

function loadHooksFromFile(filePath: string): HookConfig {
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parse(raw);

  return validateHookConfig(parsed?.hooks ?? {});
}

function validateHookConfig(raw: unknown): HookConfig {
  if (typeof raw !== 'object' || raw === null) return {};
  const result: HookConfig = {};

  for (const [key, val] of Object.entries(raw)) {
    if (isHookEvent(key) && Array.isArray(val) && val.every((v) => typeof v === 'string')) {
      result[key] = val;
    }
  }

  return result;
}

function isHookEvent(key: string): key is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(key);
}

function mergeHookConfigs(...configs: HookConfig[]): HookConfig {
  const result: HookConfig = {};

  for (const config of configs) {
    for (const [event, commands] of Object.entries(config)) {
      const key = event as HookEvent;
      if (!commands?.length) continue;

      result[key] = [...(result[key] ?? []), ...commands];
    }
  }

  return result;
}

export function loadAllHooks(root: string): HookConfig {
  const projectHooks = loadHooksFromFile(getConfigPath(root));
  const localHooks = loadHooksFromFile(getLocalConfigPath(root));
  const userHooks = loadHooksFromFile(getUserConfigPath());

  return mergeHookConfigs(projectHooks, localHooks, userHooks);
}

export async function runHooks(
  event: HookEvent,
  context: ScriptContext,
  cwd?: string,
): Promise<void> {
  const hooks = loadAllHooks(context.root);
  const commands = hooks[event];

  if (!commands?.length) return;

  for (const command of commands) {
    await runCommand(command, context, cwd ?? context.featureDir);
  }
}
