import { $ } from 'bun';

/** Run a git command quietly in a given directory, returning stdout text. */
export async function gitExec(root: string, args: string): Promise<string> {
  const result = await $`git -C ${root} ${{ raw: args }}`.quiet();
  return result.text();
}
