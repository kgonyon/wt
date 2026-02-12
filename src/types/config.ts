import type { HookConfig } from './hooks';

export interface WorktreesConfig {
  dir: string;
  branch_prefix: string;
}

export interface PortConfig {
  base_port: number;
  max_ports: number;
  ports_per_feature: number;
}

export interface EnvFile {
  source: string;
  dest: string;
  replace: Record<string, string>;
}

export interface EnvFilePackage {
  package: string;
  path: string;
  files: EnvFile[];
}

export interface CommandConfig {
  name: string;
  command: string;
  description?: string;
  scope?: 'feature' | 'project';
}

export interface ScriptsConfig {
  setup?: string;
  cleanup?: string;
}

export interface WtConfig {
  name: string;
  worktrees: WorktreesConfig;
  port: PortConfig;
  scripts?: ScriptsConfig;
  commands?: CommandConfig[];
  env_files?: EnvFilePackage[];
  hooks?: HookConfig;
}

export interface PortAllocation {
  index: number;
}

export interface PortAllocations {
  features: Record<string, PortAllocation>;
}
