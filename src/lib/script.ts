import { join, resolve } from 'path';

export interface ScriptContext {
  root: string;
  feature: string;
  featureDir: string;
  projectName: string;
  ports: number[];
  basePort: number;
}

export function buildEnv(context: ScriptContext): Record<string, string> {
  const env: Record<string, string> = {
    WT_PROJECT: context.projectName,
    WT_PROJECT_DIR: context.root,
    WT_FEATURE: context.feature,
    WT_FEATURE_DIR: context.featureDir,
    WT_PORT: String(context.basePort),
  };

  for (let i = 0; i < context.ports.length; i++) {
    env[`WT_PORT_${i + 1}`] = String(context.ports[i]);
  }

  return env;
}

export async function runScript(
  scriptPath: string,
  context: ScriptContext,
  cwd?: string,
): Promise<void> {
  const base = join(context.root, '.wt');
  const resolvedPath = resolve(base, scriptPath);
  if (!resolvedPath.startsWith(base + '/') && resolvedPath !== base) {
    throw new Error(`Script path escapes .wt directory: ${scriptPath}`);
  }
  const env = { ...process.env, ...buildEnv(context) };

  const proc = Bun.spawn([resolvedPath], {
    cwd: cwd ?? context.featureDir,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Script failed: ${scriptPath} (exit code ${exitCode})`);
  }
}

export async function runCommand(
  command: string,
  context: ScriptContext,
  cwd: string,
): Promise<void> {
  const env = { ...process.env, ...buildEnv(context) };

  const proc = Bun.spawn(['sh', '-c', command], {
    cwd,
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command} (exit code ${exitCode})`);
  }
}
