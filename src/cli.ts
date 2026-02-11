import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'wt',
    version: '1.0.0',
    description: 'Worktree development workflow manager',
  },
  subCommands: {
    up: () => import('./commands/up').then((m) => m.default),
    down: () => import('./commands/down').then((m) => m.default),
    dev: () => import('./commands/dev').then((m) => m.default),
    status: () => import('./commands/status').then((m) => m.default),
    doctor: () => import('./commands/doctor').then((m) => m.default),
  },
});

runMain(main);
