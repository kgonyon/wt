import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getPortAllocationsPath } from './paths';
import type { PortAllocations, PortsConfig } from '../types/config';

export function loadPortAllocations(root: string): PortAllocations {
  const path = getPortAllocationsPath(root);

  if (!existsSync(path)) {
    return { features: {} };
  }

  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as PortAllocations;
}

export function savePortAllocations(root: string, allocations: PortAllocations): void {
  const path = getPortAllocationsPath(root);
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, JSON.stringify(allocations, null, 2) + '\n');
}

export function allocatePorts(root: string, feature: string, portsConfig: PortsConfig): number {
  const allocations = loadPortAllocations(root);

  if (allocations.features[feature]) {
    return allocations.features[feature].index;
  }

  const usedIndices = new Set(
    Object.values(allocations.features).map((a) => a.index),
  );

  const maxSlots = Math.floor(portsConfig.max / portsConfig.per_feature);
  let index = 0;

  while (usedIndices.has(index) && index < maxSlots) {
    index++;
  }

  if (index >= maxSlots) {
    throw new Error(`No available port slots (max ${maxSlots} features)`);
  }

  allocations.features[feature] = { index };
  savePortAllocations(root, allocations);

  return index;
}

export function deallocatePorts(root: string, feature: string): void {
  const allocations = loadPortAllocations(root);
  delete allocations.features[feature];
  savePortAllocations(root, allocations);
}

export function getPortsForFeature(portsConfig: PortsConfig, index: number): number[] {
  const ports: number[] = [];

  for (let i = 0; i < portsConfig.per_feature; i++) {
    ports.push(portsConfig.base + index * portsConfig.per_feature + i);
  }

  return ports;
}
