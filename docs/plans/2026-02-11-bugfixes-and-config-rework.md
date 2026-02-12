# Spec: Bugfixes & Config Rework — Worktree Resolution, Hooks, Scoped Commands, Env Simplification

**Date:** 2026-02-11
**Status:** reviewing

## Summary

Fix the root cause bug where `getProjectRoot()` fails inside feature worktrees (breaking `wt down`, `wt run`, and port lookups), rework the hook system to use ramp's array-of-objects syntax with simplified event names (`up`, `down`, `run`), enforce command scoping (feature vs project) with proper script resolution from the correct `.wt/` directory, simplify the port config keys to shorter names, and flatten `env_files` by removing the `package` wrapper.

## Technical Specification

- **Stack:** TypeScript, Bun, citty (CLI), consola (logging), yaml (config parsing)
- **New Dependencies:** None

## Key Decisions

- **Worktree-aware root resolution:** Use `git rev-parse --path-format=absolute --git-common-dir` to find the shared `.git` directory, then derive the project root. This works from both the project root and any worktree. Falls back to `--show-toplevel` for non-worktree contexts.
- **Shorter port config keys:** Change `PortConfig` from `{base_port, max_ports, ports_per_feature}` to `{base, per_feature, max}` under the `port:` key. Matches avatar's existing config and is cleaner.
- **Ramp-style hook syntax:** Hooks use array-of-objects format: `hooks: [{event: up, command: hooks/up.sh}]`. Script paths resolve relative to the config file's directory (project `.wt/`, local `.wt/`, or user `~/.config/wt/`). This matches ramp's hook syntax exactly.
- **Simplified hook events:** Three events: `up` (fires after worktree creation + env generation + setup script), `down` (fires before worktree removal, so hooks can access the tree), `run` (fires after the command completes). Removes the pre/post distinction.
- **Feature-scoped script resolution:** Feature-scoped commands resolve scripts from `<treePath>/.wt/scripts/` (the tree's working copy). Project-scoped commands resolve from `<projectRoot>/.wt/scripts/`.
- **Project-scoped commands don't require a feature:** Project-scoped commands work without a feature context. `WT_FEATURE` and `WT_FEATURE_DIR` env vars are empty/unset. Feature-scoped commands must be in a feature tree or error.
- **Flat env_files:** Remove the `package` wrapper. Each env file entry has `path` (relative to worktree root), `source`, `dest`, and `replace`. The `path` field replaces the old `package.path`.

## In Scope

- Fix `getProjectRoot()` to work inside worktrees
- Fix `getGitRoot()` to return the main project root, not the worktree root
- Update `PortConfig` to use shorter key names (`base`, `per_feature`, `max`)
- Rework hook system: array-of-objects syntax, simplified events (`up`/`down`/`run`), script path resolution relative to config dir
- Enforce command scoping: feature-scoped commands error if not in a tree, project-scoped commands skip feature resolution
- Feature-scoped commands resolve scripts from tree's `.wt/`, project-scoped from project root's `.wt/`
- Flatten `env_files` config (remove `package` key)
- Update avatar `.wt/config.yaml` to match new config schema
- Update wt's own `.wt/config.yaml` to match

## Out of Scope

- Adding tests (future enhancement)
- Config schema validation with zod or similar (future enhancement)
- Templates directory (future enhancement)
- Prompts system (future enhancement)
- `--dry-run`, `--verbose`, `--force` flags (future enhancement)
- Port availability checking (future enhancement)
- Stale allocation cleanup (future enhancement)

## Deferred Decisions

- **Branch cleanup on `wt down`:** May add optional branch deletion when a feature is torn down. Defer until needed.
- **`wt config` inspection command:** May add a command to show merged config with source annotations. Defer until needed.

## Acceptance Criteria

### CLI — Bug Fixes

- [x] `wt down <feature>` works when run from the project root
- [ ] `wt down` (no args) works when run from inside a feature worktree (auto-detects feature)
- [ ] `wt run dev` works when run from inside a feature worktree (auto-detects feature)
- [ ] `wt run dev -f <feature>` works when run from the project root
- [ ] `wt up <feature>` still works from the project root (no regression)
- [ ] `wt status` works from both project root and inside a feature worktree
- [ ] Port allocations are read from the project root's `.wt/port_allocations.json` regardless of cwd

### CLI — Scoped Commands

- [ ] Feature-scoped command (`scope: feature`) errors with a clear message if not in a feature tree and no `-f` flag provided
- [ ] Feature-scoped command sets cwd to the feature tree path
- [ ] Feature-scoped command resolves script paths from `<treePath>/.wt/`
- [ ] Project-scoped command (`scope: project`) runs from the project root regardless of cwd
- [ ] Project-scoped command resolves script paths from `<projectRoot>/.wt/`
- [ ] Project-scoped command works without a feature context (`WT_FEATURE` and `WT_FEATURE_DIR` are empty)
- [ ] Default scope (not specified) behaves as `feature`

### Config — Port Keys

- [ ] `port.base` is used instead of `port.base_port`
- [ ] `port.per_feature` is used instead of `port.ports_per_feature`
- [ ] `port.max` is used instead of `port.max_ports`
- [ ] Port allocation produces correct port numbers with the new config keys

### Config — Hooks

- [ ] Hooks accept array-of-objects syntax: `hooks: [{event: up, command: hooks/up.sh}]`
- [ ] Hook event `up` fires after worktree creation, env generation, and setup script
- [ ] Hook event `down` fires before worktree removal (tree still accessible)
- [ ] Hook event `run` fires after the command completes
- [ ] Hook script paths resolve relative to the config file's directory
- [ ] Project hooks fire first, then local, then user
- [ ] User hooks at `~/.config/wt/config.yaml` are loaded with paths relative to `~/.config/wt/`
- [ ] A failing hook aborts the operation and exits non-zero
- [ ] All hooks receive `WT_*` env vars

### Config — Env Files

- [ ] `env_files` accepts flat format: `[{path, source, dest, replace}]`
- [ ] `path` is relative to worktree root (replaces old `package.path`)
- [ ] Env file generation works correctly with the flat format
- [ ] No `package` key is required or expected

### Error Handling

- [ ] Running a feature-scoped command outside a feature tree gives: `"Command '<name>' requires a feature context. Run from inside a feature tree or pass -f <feature>."`
- [ ] Running `wt down` outside a feature tree without an argument gives a clear error
- [ ] Invalid hook event names in config are silently ignored (graceful degradation)

---

## Phases

### Phase 1: Fix Root Resolution & Port Config

**Status:** completed
**Dependencies:** None

#### Summary

Fix the core bug causing all worktree-context failures. Update `getProjectRoot()` to be worktree-aware using `git rev-parse --git-common-dir`. Also update `PortConfig` to shorter key names and update all code that references the old names.

#### Tasks

- [ ] Rewrite `getGitRoot()` in `src/lib/paths.ts` — use `git rev-parse --path-format=absolute --git-common-dir` to get the shared git dir, strip trailing `.git` or `.git/worktrees/<name>` to get project root. Fall back to `--show-toplevel` if `--git-common-dir` returns a relative path or fails.
- [ ] Update `getProjectRoot()` to use the new `getGitRoot()`
- [ ] Update `PortConfig` in `src/types/config.ts`: rename `base_port` -> `base`, `max_ports` -> `max`, `ports_per_feature` -> `per_feature`
- [ ] Update `src/lib/ports.ts` to use new key names (`config.base`, `config.per_feature`, `config.max`)
- [ ] Update `src/commands/up.ts` port calculation to use new key names
- [ ] Update avatar `.wt/config.yaml` port section to use `port:` key with `base`, `per_feature`, `max`
- [ ] Update wt's own `.wt/config.yaml` if it has port config
- [ ] Verify `wt down` and `wt run` work from inside a worktree after the fix

#### Testing

Build and run `wt status` from both project root and a feature tree. Run `wt down` from inside a feature tree. Verify port allocations are found correctly.

Covers: CLI Bug Fixes (all), Config Port Keys (all).

#### Files Changed

| File | Changes |
|------|---------|
| `src/lib/paths.ts` | Rewrite `getGitRoot()` for worktree awareness |
| `src/types/config.ts` | Rename PortConfig fields |
| `src/lib/ports.ts` | Update port field references |
| `src/commands/up.ts` | Update port field references |
| `/Users/kgonyon/Projects/avatar/.wt/config.yaml` | Update port key to new schema |

#### Notes

- `git rev-parse --path-format=absolute --git-common-dir` returns the `.git` directory for the main repo, or `.git/worktrees/<name>` for worktrees. Either way, we can walk up to find the project root.
- This is the highest-priority fix — everything else depends on correct root resolution.

---

### Phase 2: Ramp-Style Hooks

**Status:** completed
**Dependencies:** Phase 1

#### Summary

Rework the hook system to use ramp's array-of-objects syntax with simplified event names (`up`, `down`, `run`). Script paths in hooks resolve relative to the config file's directory.

#### Tasks

- [ ] Update `src/types/hooks.ts`: change `HOOK_EVENTS` to `['up', 'down', 'run']`, update `HookEvent` type, add `HookEntry` type (`{event: HookEvent, command: string}`), change `HookConfig` to `HookEntry[]`
- [ ] Rewrite `src/lib/hooks.ts`:
  - `loadHooksFromFile(filePath, configDir)` — parse array-of-objects format, resolve relative command paths against `configDir`
  - `validateHookConfig(raw)` — validate array-of-objects shape
  - `mergeHookConfigs(...configs)` — concatenate arrays (project first, then local, then user)
  - `runHooks(event, context, cwd?)` — filter entries by event, execute each command
- [ ] Update `src/commands/up.ts`: change `runHooks('post_up', ...)` to `runHooks('up', ...)`, remove `pre_up` call, move `up` hook to fire after setup script
- [ ] Update `src/commands/down.ts`: change `runHooks('pre_down', ...)` to `runHooks('down', ...)`, remove `post_down` call, ensure `down` hook fires before worktree removal
- [ ] Update `src/commands/run.ts`: change `runHooks('post_run', ...)` to `runHooks('run', ...)`, remove `pre_run` call
- [ ] Update avatar `.wt/config.yaml` hooks section to new array-of-objects format
- [ ] Update wt's own `.wt/config.yaml` hooks if any

#### Testing

Build and run `wt up <feature>` — verify `up` hook fires after creation. Run `wt down <feature>` — verify `down` hook fires before removal. Run `wt run dev` — verify `run` hook fires after command.

Covers: Config Hooks (all), Error Handling (invalid hook events).

#### Files Changed

| File | Changes |
|------|---------|
| `src/types/hooks.ts` | New event names, HookEntry type, array-based HookConfig |
| `src/lib/hooks.ts` | Rewrite for array-of-objects parsing and config-dir-relative resolution |
| `src/commands/up.ts` | Simplified hook calls |
| `src/commands/down.ts` | Simplified hook calls |
| `src/commands/run.ts` | Simplified hook calls |
| `/Users/kgonyon/Projects/avatar/.wt/config.yaml` | Update hooks to array-of-objects |

---

### Phase 3: Scoped Commands

**Status:** completed
**Dependencies:** Phase 1

#### Summary

Enforce feature/project command scoping. Feature-scoped commands require a feature context and resolve scripts from the tree's `.wt/`. Project-scoped commands run at the project root with no feature requirement.

#### Tasks

- [ ] Update `src/commands/run.ts`:
  - Branch on `cmdConfig.scope` early
  - For `scope: 'feature'` (or default): call `resolveFeature()`, build full `ScriptContext`, resolve script cwd from `treePath`, resolve command paths relative to `<treePath>/.wt/`
  - For `scope: 'project'`: skip feature resolution, build `ScriptContext` with empty feature/featureDir, resolve script cwd to project root, resolve command paths relative to `<projectRoot>/.wt/`
- [ ] Update `src/lib/script.ts` `runCommand()`: when command is a relative path (contains `/` or ends in `.sh`), resolve it relative to the appropriate `.wt/` directory based on a new `scriptRoot` parameter
- [ ] Update `resolveFeature()` in `src/lib/detect.ts` to throw a scoped error message when in feature-required context: `"Command '<name>' requires a feature context. Run from inside a feature tree or pass -f <feature>."`
- [ ] Ensure `ScriptContext` supports optional/empty feature fields for project-scoped commands
- [ ] Update `buildEnv()` in `src/lib/script.ts` to handle empty feature (don't set `WT_FEATURE`/`WT_FEATURE_DIR` if empty)

#### Testing

From inside a feature tree: `wt run dev` works (feature-scoped, auto-detects). From project root: `wt run dev` errors (no feature context). From project root: `wt run dev -f <feature>` works. Project-scoped command works from anywhere.

Covers: CLI Scoped Commands (all), Error Handling (feature-scoped outside tree).

#### Files Changed

| File | Changes |
|------|---------|
| `src/commands/run.ts` | Branch on scope, different resolution paths |
| `src/lib/script.ts` | Add scriptRoot param for relative path resolution, handle empty feature |
| `src/lib/detect.ts` | Better error message for feature-required context |

---

### Phase 4: Flatten Env Files & Final Config Migration

**Status:** completed
**Dependencies:** Phase 1

#### Summary

Remove the `package` wrapper from `env_files` config. Each entry has `path`, `source`, `dest`, `replace` directly. Update all code and avatar config.

#### Tasks

- [ ] Update `src/types/config.ts`: remove `EnvFilePackage` type, replace `WtConfig.env_files` type with a flat array: `{path: string, source: string, dest: string, replace: Record<string, string>}[]`
- [ ] Update `src/lib/env.ts` `generateEnvFiles()`: iterate flat array directly, use `entry.path` as the base directory relative to worktree root
- [ ] Update `src/commands/up.ts`: pass flat env_files to `generateEnvFiles()`
- [ ] Update avatar `.wt/config.yaml` env_files section: flatten from nested `package.files[]` to flat entries with `path`
- [ ] Update wt's own `.wt/config.yaml` if it has env_files
- [ ] Update `src/commands/init.ts` config template to show flat env_files format

#### Testing

Run `wt up <feature>` on avatar — verify `.env` files are generated correctly in `packages/api/` and `packages/ui/` within the worktree.

Covers: Config Env Files (all).

#### Files Changed

| File | Changes |
|------|---------|
| `src/types/config.ts` | Remove EnvFilePackage, flatten env_files type |
| `src/lib/env.ts` | Simplify to iterate flat array |
| `src/commands/up.ts` | Update env generation call |
| `src/commands/init.ts` | Update config template |
| `/Users/kgonyon/Projects/avatar/.wt/config.yaml` | Flatten env_files |

---

### Phase 5: Build, Validate & End-to-End Test

**Status:** completed
**Dependencies:** Phase 2, Phase 3, Phase 4

#### Summary

Build the wt binary, run type checking, and validate all changes work end-to-end against the avatar project.

#### Tasks

- [ ] Run `bun run typecheck` — must pass
- [ ] Run `bun run build` — must produce `dist/wt`
- [ ] Install locally: `bun run install:local`
- [ ] From avatar project root: run `wt status` — should work
- [ ] From avatar project root: run `wt up test-validation` — should create worktree, allocate ports, generate env files, run hooks
- [ ] From inside the created worktree: run `wt run dev` — should detect feature, find command, resolve script from tree's `.wt/`
- [ ] From inside the worktree: run `wt down` — should auto-detect feature, run down hook, remove worktree, deallocate ports
- [ ] Verify port_allocations.json is clean after down
- [ ] Run `wt down test-validation` to clean up if needed

#### Testing

Full end-to-end CLI validation against avatar project. All acceptance criteria verified.

#### Files Changed

| File | Changes |
|------|---------|
| (no file changes — validation only) | |

---

## Reviews

[Populated during review loop]
