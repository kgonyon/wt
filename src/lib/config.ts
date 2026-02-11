import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { getConfigPath, getLocalConfigPath } from './paths';
import type { WtConfig } from '../types/config';

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadConfig(root: string): WtConfig {
  const configPath = getConfigPath(root);
  const raw = readFileSync(configPath, 'utf-8');
  let config = parse(raw) as WtConfig;

  const localPath = getLocalConfigPath(root);
  if (existsSync(localPath)) {
    const localRaw = readFileSync(localPath, 'utf-8');
    const localConfig = parse(localRaw);
    config = deepMerge(config, localConfig) as WtConfig;
  }

  return config;
}
