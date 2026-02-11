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
    run: () => import('./commands/run').then((m) => m.default),
    refresh: () => import('./commands/refresh').then((m) => m.default),
    status: () => import('./commands/status').then((m) => m.default),
  },
});

runMain(main);
