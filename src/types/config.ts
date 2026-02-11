export interface EnvFile {
  source: string;
  dest: string;
  replace: Record<string, string>;
}

export interface Package {
  name: string;
  path: string;
  env_files: EnvFile[];
}

export interface Service {
  name: string;
  command: string;
  working_dir: string;
  pre_hooks?: string[];
}

export interface PortsConfig {
  base: number;
  per_feature: number;
  max: number;
}

export interface WorktreesConfig {
  dir: string;
  branch_prefix: string;
}

export interface SetupConfig {
  hooks: string[];
}

export interface LogsConfig {
  dir: string;
}

export interface WtConfig {
  name: string;
  worktrees: WorktreesConfig;
  ports: PortsConfig;
  packages: Package[];
  services: Service[];
  setup: SetupConfig;
  logs: LogsConfig;
}

export interface PortAllocation {
  index: number;
}

export interface PortAllocations {
  features: Record<string, PortAllocation>;
}
