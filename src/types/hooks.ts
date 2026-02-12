export const HOOK_EVENTS = ['up', 'down', 'run'] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HookEntry {
  event: HookEvent;
  command: string;
}

export type HookConfig = HookEntry[];
