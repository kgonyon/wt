import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Package } from '../types/config';

export function generateEnvFiles(
  worktreePath: string,
  packages: Package[],
  ports: number[],
): void {
  const portVars = buildPortVars(ports);

  for (const pkg of packages) {
    const pkgPath = join(worktreePath, pkg.path);
    for (const envFile of pkg.env_files) {
      processEnvFile(pkgPath, envFile.source, envFile.dest, envFile.replace, portVars);
    }
  }
}

function buildPortVars(ports: number[]): Record<string, string> {
  const vars: Record<string, string> = {};

  for (let i = 0; i < ports.length; i++) {
    vars[`WT_PORT_${i + 1}`] = String(ports[i]);
  }

  return vars;
}

function processEnvFile(
  pkgPath: string,
  source: string,
  dest: string,
  replace: Record<string, string>,
  portVars: Record<string, string>,
): void {
  const sourcePath = join(pkgPath, source);
  const destPath = join(pkgPath, dest);

  if (!existsSync(sourcePath)) {
    throw new Error(`Env template not found: ${sourcePath}`);
  }

  let content = readFileSync(sourcePath, 'utf-8');
  content = applyReplacements(content, replace, portVars);

  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content);
}

function applyReplacements(
  content: string,
  replace: Record<string, string>,
  portVars: Record<string, string>,
): string {
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    result.push(processLine(line, replace, portVars));
  }

  return result.join('\n');
}

function processLine(
  line: string,
  replace: Record<string, string>,
  portVars: Record<string, string>,
): string {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)/);
  if (!match) return line;

  const [, key, originalValue] = match;
  if (!(key in replace)) return line;

  const value = substitutePortVars(replace[key], portVars);
  return `${key}=${value}`;
}

function substitutePortVars(template: string, portVars: Record<string, string>): string {
  return template.replace(/\$\{(WT_PORT_\d+)\}/g, (_, varName) => {
    return portVars[varName] ?? `\${${varName}}`;
  });
}
