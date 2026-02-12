import { describe, it, expect } from 'bun:test';
import { getPortsForFeature } from './ports';
import type { PortConfig } from '../types/config';

function makePortConfig(overrides: Partial<PortConfig> = {}): PortConfig {
  return {
    base: 3000,
    per_feature: 10,
    max: 100,
    ...overrides,
  };
}

describe('getPortsForFeature', () => {
  it('returns correct ports for index 0', () => {
    const ports = getPortsForFeature(makePortConfig(), 0);
    expect(ports).toEqual([3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009]);
  });

  it('returns correct ports for index 1', () => {
    const ports = getPortsForFeature(makePortConfig(), 1);
    expect(ports).toEqual([3010, 3011, 3012, 3013, 3014, 3015, 3016, 3017, 3018, 3019]);
  });

  it('returns correct ports for index 2', () => {
    const ports = getPortsForFeature(makePortConfig(), 2);
    expect(ports[0]).toBe(3020);
    expect(ports[9]).toBe(3029);
  });

  it('handles per_feature of 1', () => {
    const config = makePortConfig({ per_feature: 1 });
    expect(getPortsForFeature(config, 0)).toEqual([3000]);
    expect(getPortsForFeature(config, 5)).toEqual([3005]);
  });

  it('handles custom base port', () => {
    const config = makePortConfig({ base: 8000, per_feature: 3 });
    const ports = getPortsForFeature(config, 0);
    expect(ports).toEqual([8000, 8001, 8002]);
  });

  it('handles custom base port with offset index', () => {
    const config = makePortConfig({ base: 8000, per_feature: 3 });
    const ports = getPortsForFeature(config, 2);
    expect(ports).toEqual([8006, 8007, 8008]);
  });

  it('returns per_feature number of ports', () => {
    const config = makePortConfig({ per_feature: 5 });
    expect(getPortsForFeature(config, 0)).toHaveLength(5);
  });
});
