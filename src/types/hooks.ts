export const HOOK_EVENTS = [
  'pre_up',
  'post_up',
  'pre_down',
  'post_down',
  'pre_run',
  'post_run',
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export type HookConfig = Partial<Record<HookEvent, string[]>>;
