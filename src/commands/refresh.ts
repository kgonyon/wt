import { defineCommand } from 'citty';
import consola from 'consola';
import { $ } from 'bun';
import { getProjectRoot } from '../lib/paths';

export default defineCommand({
  meta: {
    name: 'refresh',
    description: 'Fetch latest changes from the default branch',
  },
  async run() {
    const root = await getProjectRoot();
    const branch = await detectDefaultBranch(root);

    consola.start(`Fetching origin/${branch}...`);

    const result = await $`git -C ${root} fetch origin ${branch}`.quiet();
    const output = result.text().trim();

    if (output) {
      consola.info(output);
    }

    consola.success(`Fetched latest from origin/${branch}`);
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
