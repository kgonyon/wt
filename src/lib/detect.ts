export function detectFeatureFromCwd(cwd: string, treesDir: string): string | null {
  const normalized = cwd.replace(/\\/g, '/');
  const treesSeg = treesDir.replace(/\/$/, '');
  const idx = normalized.indexOf(`/${treesSeg}/`);

  if (idx === -1) return null;

  const afterTrees = normalized.slice(idx + treesSeg.length + 2);
  const feature = afterTrees.split('/')[0];

  return feature || null;
}

export function resolveFeature(feature: string | undefined, treesDir: string): string {
  if (feature) return feature;

  const detected = detectFeatureFromCwd(process.cwd(), treesDir);
  if (!detected) {
    throw new Error('Could not detect feature name. Provide it as an argument.');
  }

  return detected;
}
