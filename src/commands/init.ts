import { defineCommand } from 'citty';
import consola from 'consola';
import { basename, join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile, appendFile, readFile, chmod } from 'fs/promises';
import { getGitRoot, isWtProject } from '../lib/paths';

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a new wt project with boilerplate config and scripts',
  },
  async run() {
    const root = await getGitRoot();

    if (isWtProject(root)) {
      throw new Error('Project already initialized. Config exists at .wt/config.yaml');
    }

    const projectName = basename(root);

    await createDirectories(root);
    await createConfigFile(root, projectName);
    await createSetupScript(root);
    await createCleanupScript(root);
    await updateGitignore(root);

    consola.success('Initialized wt project');
    consola.box(
      [
        'Created:',
        '  .wt/config.yaml',
        '  .wt/scripts/setup.sh',
        '  .wt/scripts/cleanup.sh',
        '',
        'Next steps:',
        '  1. Edit .wt/config.yaml to match your project',
        '  2. Customize the setup and cleanup scripts',
        '  3. Run `wt up <feature>` to create your first worktree',
      ].join('\n'),
    );
  },
});

async function createDirectories(root: string): Promise<void> {
  await mkdir(join(root, '.wt', 'scripts'), { recursive: true });
}

async function createConfigFile(root: string, projectName: string): Promise<void> {
  const content = `# wt project configuration
# Docs: https://github.com/nicholasgonyon/wt

name: ${projectName}

worktrees:
  # Directory where feature worktrees are created (relative to project root)
  dir: trees
  # Prefix for feature branches (e.g., feature/my-feature)
  branch_prefix: feature/

port:
  # Starting port number for allocations
  base: 3000
  # Number of ports allocated per feature worktree
  per_feature: 2
  # Total number of ports in the allocation pool
  max: 100

scripts:
  # Run after worktree creation and env file generation (path relative to .wt/)
  setup: scripts/setup.sh
  # Run before worktree removal (path relative to .wt/)
  cleanup: scripts/cleanup.sh

# commands:
#   - name: dev
#     command: npm run dev
#     description: Start development server
#     scope: feature

# env_files:
#   - path: .
#     source: .env.example
#     dest: .env
#     replace:
#       PORT: "\${WT_PORT_1}"

# hooks:
#   - event: up
#     command: echo "Ready!"
#   - event: down
#     command: echo "Tearing down..."
#   - event: run
#     command: echo "Command finished!"
`;

  await writeFile(join(root, '.wt', 'config.yaml'), content);
}

async function createSetupScript(root: string): Promise<void> {
  const content = `#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# Setup script — runs after worktree creation and env file generation
# during \`wt up <feature>\`.
#
# Available environment variables:
#   WT_PROJECT      — Project name from config
#   WT_PROJECT_DIR  — Absolute path to the project root
#   WT_FEATURE      — Feature name (e.g., "my-feature")
#   WT_FEATURE_DIR  — Absolute path to the feature worktree
#   WT_PORT         — First allocated port (alias for WT_PORT_1)
#   WT_PORT_1       — First allocated port
#   WT_PORT_2       — Second allocated port
#   WT_PORT_N       — Nth port (up to per_feature)
#
# Working directory is set to the feature worktree.
# ------------------------------------------------------------------

echo "Setting up feature: $WT_FEATURE"

# Example: Install dependencies
# npm install

# Example: Run database migrations
# npm run db:migrate

# Example: Seed test data
# npm run db:seed
`;

  const scriptPath = join(root, '.wt', 'scripts', 'setup.sh');
  await writeFile(scriptPath, content);
  await chmod(scriptPath, 0o755);
}

async function createCleanupScript(root: string): Promise<void> {
  const content = `#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# Cleanup script — runs before worktree removal during \`wt down\`.
#
# Available environment variables:
#   WT_PROJECT      — Project name from config
#   WT_PROJECT_DIR  — Absolute path to the project root
#   WT_FEATURE      — Feature name (e.g., "my-feature")
#   WT_FEATURE_DIR  — Absolute path to the feature worktree
#   WT_PORT         — First allocated port (alias for WT_PORT_1)
#   WT_PORT_1       — First allocated port
#   WT_PORT_2       — Second allocated port
#   WT_PORT_N       — Nth port (up to per_feature)
#
# Working directory is set to the feature worktree.
# ------------------------------------------------------------------

echo "Cleaning up feature: $WT_FEATURE"

# Example: Drop feature database
# dropdb "myapp_\${WT_FEATURE}" --if-exists

# Example: Remove temporary files
# rm -rf tmp/

# Example: Stop any running services
# docker compose down
`;

  const scriptPath = join(root, '.wt', 'scripts', 'cleanup.sh');
  await writeFile(scriptPath, content);
  await chmod(scriptPath, 0o755);
}

async function updateGitignore(root: string): Promise<void> {
  const gitignorePath = join(root, '.gitignore');
  const entries = ['.wt/local.yaml', '.wt/port_allocations.json'];

  const existing = existsSync(gitignorePath)
    ? await readFile(gitignorePath, 'utf-8')
    : '';

  const missing = entries.filter((entry) => !existing.includes(entry));

  if (missing.length === 0) return;

  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const block = `${prefix}\n# wt local files\n${missing.join('\n')}\n`;

  await appendFile(gitignorePath, block);
}
