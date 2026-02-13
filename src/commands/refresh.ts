import { defineCommand } from 'citty';
import consola from 'consola';
import { $ } from 'bun';
import { getProjectRoot } from '../lib/paths';
import { isWorktreeDirty } from '../lib/git';

export default defineCommand({
  meta: {
    name: 'refresh',
    description: 'Pull latest changes from the default branch',
  },
  async run() {
    const root = await getProjectRoot();

    const isDirty = await isWorktreeDirty(root);
    if (isDirty) {
      consola.error('Uncommitted changes detected. Commit or stash them before refreshing.');
      process.exit(1);
    }

    const branch = await detectDefaultBranch(root);

    consola.start(`Pulling origin/${branch}...`);

    const result = await $`git -C ${root} pull origin ${branch}`.quiet();
    const output = result.text().trim();

    if (output) {
      consola.info(output);
    }

    consola.success(`Pulled latest from origin/${branch}`);
  },
});

async function detectDefaultBranch(root: string): Promise<string> {
  try {
    const result = await $`git -C ${root} symbolic-ref refs/remotes/origin/HEAD`.quiet();
    const ref = result.text().trim();
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    return 'main';
  }
}
