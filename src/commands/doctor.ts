import { defineCommand } from 'citty';
import consola from 'consola';
import { existsSync } from 'fs';
import { $ } from 'bun';
import { getGitRoot, getConfigPath } from '../lib/paths';
import { loadConfig } from '../lib/config';

interface CheckResult {
  name: string;
  pass: boolean;
  message: string;
}

export default defineCommand({
  meta: {
    name: 'doctor',
    description: 'Validate environment and configuration',
  },
  async run() {
    consola.start('Running diagnostics...\n');

    const results: CheckResult[] = [];

    results.push(await checkTool('git'));
    results.push(await checkTool('bun'));
    results.push(await checkConfigExists());
    results.push(await checkConfigValid());

    printResults(results);
  },
});

async function checkTool(name: string): Promise<CheckResult> {
  try {
    const result = await $`which ${name}`.quiet();
    const path = result.text().trim();
    return { name: `${name} installed`, pass: true, message: path };
  } catch {
    return { name: `${name} installed`, pass: false, message: 'not found in PATH' };
  }
}

async function checkConfigExists(): Promise<CheckResult> {
  try {
    const root = await getGitRoot();
    const configPath = getConfigPath(root);
    const exists = existsSync(configPath);

    return {
      name: '.wt/config.yaml exists',
      pass: exists,
      message: exists ? configPath : 'not found',
    };
  } catch {
    return {
      name: '.wt/config.yaml exists',
      pass: false,
      message: 'not inside a git repository',
    };
  }
}

async function checkConfigValid(): Promise<CheckResult> {
  try {
    const root = await getGitRoot();
    const config = loadConfig(root);
    const issues = validateConfig(config);

    if (issues.length > 0) {
      return { name: 'config valid', pass: false, message: issues.join(', ') };
    }

    return { name: 'config valid', pass: true, message: `project: ${config.name}` };
  } catch (err: any) {
    return { name: 'config valid', pass: false, message: err.message };
  }
}

function validateConfig(config: any): string[] {
  const issues: string[] = [];

  if (!config.name) issues.push('missing "name"');
  if (!config.worktrees?.dir) issues.push('missing "worktrees.dir"');
  if (!config.ports?.base) issues.push('missing "ports.base"');
  if (!config.packages?.length) issues.push('missing "packages"');
  if (!config.services?.length) issues.push('missing "services"');

  return issues;
}

function printResults(results: CheckResult[]): void {
  let allPassed = true;

  for (const result of results) {
    const icon = result.pass ? '\u2713' : '\u2717';
    const method = result.pass ? 'success' : 'error';
    consola[method](`${icon} ${result.name}: ${result.message}`);
    if (!result.pass) allPassed = false;
  }

  console.log('');
  if (allPassed) {
    consola.success('All checks passed!');
  } else {
    consola.error('Some checks failed.');
  }
}
