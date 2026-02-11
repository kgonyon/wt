import { $ } from 'bun';
import consola from 'consola';

export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string;
}

export async function addWorktree(
  root: string,
  treePath: string,
  branchPrefix: string,
  feature: string,
): Promise<void> {
  const branch = `${branchPrefix}${feature}`;
  const branchExists = await checkBranchExists(root, branch);

  if (branchExists) {
    await $`git -C ${root} worktree add ${treePath} ${branch}`.quiet();
  } else {
    await $`git -C ${root} worktree add ${treePath} -b ${branch}`.quiet();
  }
}

async function checkBranchExists(root: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${root} rev-parse --verify ${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

export async function removeWorktree(root: string, treePath: string): Promise<void> {
  await $`git -C ${root} worktree remove ${treePath} --force`.quiet();
}

export async function listWorktrees(root: string): Promise<WorktreeInfo[]> {
  const result = await $`git -C ${root} worktree list --porcelain`.quiet();
  return parsePorcelainOutput(result.text());
}

function parsePorcelainOutput(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    const info = parseSingleBlock(block);
    if (info) worktrees.push(info);
  }

  return worktrees;
}

function parseSingleBlock(block: string): WorktreeInfo | null {
  const lines = block.trim().split('\n');
  let path = '';
  let head = '';
  let branch = '';

  for (const line of lines) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length);
    if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length);
    if (line.startsWith('branch ')) branch = line.slice('branch '.length);
  }

  if (!path) return null;
  return { path, head, branch };
}

export async function isWorktreeDirty(treePath: string): Promise<boolean> {
  try {
    const result = await $`git -C ${treePath} status --porcelain`.quiet();
    return result.text().trim().length > 0;
  } catch {
    return false;
  }
}
