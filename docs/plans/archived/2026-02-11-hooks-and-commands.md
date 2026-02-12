# Spec: Ramp-Style Rearchitecture — Scripts, Commands, Hooks

**Date:** 2026-02-11
**Status:** shipped

## Summary

Rearchitect the wt CLI from a thick orchestrator (built-in process management, dev servers, doctor checks) to a thin orchestrator modeled after ramp. wt manages git worktrees, port allocation, and env file generation — everything else is delegated to user-defined shell scripts. Built-in `dev` and `doctor` commands are removed. A `scripts` config (setup, cleanup) runs during `up`/`down`. Custom commands via `wt run <name>` dispatch to scripts defined in config. A `wt refresh` command fetches the main branch. Three-level hooks (project/local/user) fire at lifecycle events. All scripts and hooks receive `WT_*` environment variables.

## Technical Specification

- **Stack:** TypeScript, Bun, citty (CLI), consola (logging), yaml (config parsing)
- **New Dependencies:** None

## Key Decisions

- **Thin orchestrator like ramp:** wt handles worktrees, ports, and env files. Scripts handle everything else (dev servers, doctor checks, migrations, IDE setup). This removes `src/commands/dev.ts`, `src/commands/doctor.ts`, and `src/lib/process.ts`.
- **Scripts config:** `scripts.setup` runs after `wt up` creates the worktree and generates env files. `scripts.cleanup` runs before `wt down` removes the worktree. Both are shell script paths resolved from the `.wt/` directory.
- **Custom commands via `wt run <name>`:** Commands are defined in config with `name`, `command`, and optional `scope` (feature or project). `wt run dev` dispatches to the configured script. All env vars are passed.
- **`wt refresh`:** New built-in command that fetches the main branch in the main repo (not inside a worktree). Equivalent to ramp's refresh.
- **Three-level hooks:** Project (`.wt/config.yaml`), local (`.wt/local.yaml`), user (`~/.config/wt/config.yaml`). Hook events: `pre_up`, `post_up`, `pre_down`, `post_down`, `pre_run`, `post_run`. Hooks are arrays of shell command strings per event. Concatenated across levels in order: project -> local -> user.
- **`sh -c` execution:** All scripts, commands, and hooks run via `sh -c` for full shell support (pipes, redirects, `&&`). Replaces the current `command.split(' ')` + `Bun.spawn` approach.
- **Environment variables for all scripts/hooks:** `WT_PROJECT`, `WT_PROJECT_DIR`, `WT_FEATURE`, `WT_FEATURE_DIR`, `WT_PORT` (base port), plus `WT_PORT_1`, `WT_PORT_2`, etc. for individual ports. Matches ramp's `RAMP_*` pattern.
- **Relative paths resolved from `.wt/`:** Script paths like `scripts/setup.sh` resolve from the `.wt/` directory (where the config lives). User-level hook paths resolve from `~/.config/wt/`.
- **Remove built-in doctor:** Doctor becomes `wt run doctor` with a project-defined script. The wt CLI itself has no built-in validation beyond config parsing.
- **Remove built-in dev server management:** All process spawning, colored output, log file writing, signal handling moves to project scripts (`.wt/scripts/dev.sh`).
- **Config format aligns with ramp:** `scripts`, `commands`, `hooks`, `port` (not `ports`), `env_files` at package level. `setup.hooks` and `services` are removed.

## In Scope

- Remove `src/commands/dev.ts`, `src/commands/doctor.ts`, `src/lib/process.ts`
- New `wt run <name>` command dispatching to config-defined scripts
- New `wt refresh` command to fetch main branch
- `scripts.setup` and `scripts.cleanup` in config, executed during up/down
- Three-level hooks: project, local, user config
- Hook events: `pre_up`, `post_up`, `pre_down`, `post_down`, `pre_run`, `post_run`
- `WT_*` environment variables passed to all scripts/hooks
- `sh -c` execution for all external commands
- Updated `WtConfig` types reflecting new config shape
- Updated avatar `.wt/config.yaml` to new format
- New `.wt/scripts/` in avatar with `setup.sh`, `cleanup.sh`, `dev.sh`, `doctor.sh`
- User config support at `~/.config/wt/config.yaml`

## Out of Scope

- Prompts system (ramp's `prompts:` with IDE selection etc.) — future enhancement
- Templates directory (`.wt/templates/` copied to each tree) — future enhancement
- `auto_refresh` per-repo — future enhancement
- Multi-repo support (ramp manages multiple git repos; wt manages a single monorepo) — not applicable
- `scope: source` for commands (no source repos concept in wt)

## Deferred Decisions

- **Templates directory:** May add `.wt/templates/` support for copying files to worktrees (like AGENTS.md, .mcp.json). Defer until needed.
- **Prompts:** May add interactive prompts during `wt up` for IDE selection. Defer until needed.

## Acceptance Criteria

### CLI — wt up

- [ ] `wt up <feature>` creates a git worktree at `trees/<feature>` with branch `feature/<feature>`
- [ ] `wt up <feature>` allocates ports and generates env files from templates
- [ ] `wt up <feature>` runs `scripts.setup` (if configured) after worktree creation and env generation
- [ ] `scripts.setup` receives all `WT_*` env vars
- [ ] `pre_up` hooks fire before worktree creation
- [ ] `post_up` hooks fire after `scripts.setup` completes
- [ ] A failing `scripts.setup` prints an error and exits non-zero

### CLI — wt down

- [ ] `wt down <feature>` runs `scripts.cleanup` (if configured) before worktree removal
- [ ] `wt down <feature>` removes the git worktree and deallocates ports
- [ ] `wt down` auto-detects feature from cwd if inside a worktree
- [ ] `pre_down` hooks fire before `scripts.cleanup`
- [ ] `post_down` hooks fire after worktree removal
- [ ] `scripts.cleanup` receives all `WT_*` env vars

### CLI — wt run

- [ ] `wt run dev` executes the `dev` command script defined in config
- [ ] `wt run doctor` executes the `doctor` command script defined in config
- [ ] `wt run <name>` works for any custom command defined in config
- [ ] Running an undefined command prints an error and available commands
- [ ] `scope: feature` runs the script with `cwd` set to the feature worktree
- [ ] Default scope runs the script with `cwd` set to the project root
- [ ] `pre_run` hooks fire before the command script
- [ ] `post_run` hooks fire after the command script
- [ ] All command scripts receive `WT_*` env vars

### CLI — wt refresh

- [ ] `wt refresh` fetches the default branch (e.g., `main`) from origin in the main repo
- [ ] `wt refresh` works from any directory within the project

### CLI — wt status

- [ ] `wt status` shows all active feature worktrees with branch name and clean/dirty state
- [ ] `wt status` shows allocated ports for each feature

### Config

- [ ] Project config at `.wt/config.yaml` is loaded
- [ ] Local config at `.wt/local.yaml` deep-merges over project config (except hooks which concatenate)
- [ ] User config at `~/.config/wt/config.yaml` is loaded for hooks only
- [ ] Missing local or user config files are silently skipped

### Hooks

- [ ] Hooks from project config fire first, then local, then user
- [ ] `pre_up` hooks fire before worktree creation
- [ ] `post_up` hooks fire after setup script completes
- [ ] `pre_down` hooks fire before cleanup script
- [ ] `post_down` hooks fire after worktree removal
- [ ] `pre_run` hooks fire before any `wt run` command
- [ ] `post_run` hooks fire after any `wt run` command
- [ ] A failing hook aborts the operation and exits non-zero
- [ ] All hooks receive `WT_*` env vars

### Environment Variables

- [ ] `WT_PROJECT` is set to the project name from config
- [ ] `WT_PROJECT_DIR` is set to the absolute project root path
- [ ] `WT_FEATURE` is set to the current feature name
- [ ] `WT_FEATURE_DIR` is set to the absolute path to the feature worktree
- [ ] `WT_PORT` is set to the allocated base port
- [ ] `WT_PORT_1`, `WT_PORT_2`, etc. are set to individual ports in the range
- [ ] Env vars are passed via `Bun.spawn` env, not polluting the parent process

### Removed Features

- [ ] `wt dev` is no longer a built-in command (replaced by `wt run dev`)
- [ ] `wt doctor` is no longer a built-in command (replaced by `wt run doctor`)
- [ ] `services` config key is no longer used
- [ ] `setup.hooks` config key is no longer used
- [ ] `packages` config key is replaced by `env_files` at the top level or per-package

---

## Phases

### Phase 1: Core Rearchitecture — Types, Config, Script Runner

**Status:** completed
**Dependencies:** None

#### Summary

Replace the existing config types and add the script/hook execution engine. This is the foundation everything else builds on.

#### Tasks

- [ ] Rewrite `src/types/config.ts` with new config shape matching ramp:
  - `name`, `worktrees` (dir, branch_prefix), `port` (base_port, max_ports, ports_per_feature)
  - `scripts` (setup, cleanup), `commands[]` (name, command, description, scope)
  - `env_files[]` per package, `hooks` (pre_up, post_up, pre_down, post_down, pre_run, post_run)
- [ ] Create `src/types/hooks.ts` with `HookConfig`, `HookEvent` types
- [ ] Add `getUserConfigPath()` to `src/lib/paths.ts` — returns `~/.config/wt/config.yaml`
- [ ] Create `src/lib/hooks.ts`:
  - `loadAllHooks(root)` — reads hooks from project, local, user YAML independently, concatenates per-event
  - `runHooks(event, context)` — filters hooks by event, executes each via `sh -c` with `WT_*` env vars
- [ ] Create `src/lib/script.ts`:
  - `runScript(scriptPath, context)` — resolves path from `.wt/` dir, executes via `sh -c` with `WT_*` env vars, inherits stdio
  - `buildEnv(context)` — builds the `WT_*` env var record
- [ ] Update `src/lib/config.ts` to parse new config shape, keep deep-merge for local overrides
- [ ] Remove `src/lib/process.ts` (replaced by `script.ts` and `hooks.ts`)

#### Testing

`bun run typecheck` passes. New modules can be imported without errors.

Covers: Environment Variables (all), Config (project/local/user loading).

#### Files Changed

| File | Changes |
|------|---------|
| `src/types/config.ts` | Rewrite with new config shape |
| `src/types/hooks.ts` | New file: hook types |
| `src/lib/paths.ts` | Add getUserConfigPath() |
| `src/lib/hooks.ts` | New file: hook loader and runner |
| `src/lib/script.ts` | New file: script executor with env vars |
| `src/lib/config.ts` | Update for new config shape |
| `src/lib/process.ts` | Delete |

---

### Phase 2: Rewrite Commands — up, down, run, refresh, status

**Status:** completed
**Dependencies:** Phase 1

#### Summary

Rewrite all commands to use the new script/hook system. Remove dev and doctor built-in commands. Add `run` and `refresh`. Update status.

#### Tasks

- [ ] Rewrite `src/commands/up.ts`:
  - Run `pre_up` hooks
  - Create git worktree, allocate ports, generate env files (keep existing logic)
  - Run `scripts.setup` if configured
  - Run `post_up` hooks
  - Print summary
- [ ] Rewrite `src/commands/down.ts`:
  - Auto-detect feature from cwd (keep existing logic)
  - Look up ports before deallocation
  - Run `pre_down` hooks
  - Run `scripts.cleanup` if configured
  - Remove worktree, deallocate ports, clean logs
  - Run `post_down` hooks
- [ ] Create `src/commands/run.ts`:
  - Accept `command` as positional arg
  - Accept optional `feature` arg (auto-detect from cwd)
  - Look up command in config, error if not found (list available commands)
  - Resolve scope (feature = cwd is worktree path, default = project root)
  - Run `pre_run` hooks
  - Execute command script via `sh -c` with `WT_*` env vars
  - Run `post_run` hooks
- [ ] Create `src/commands/refresh.ts`:
  - Run `git fetch origin <default-branch>` in the project root
  - Print result
- [ ] Update `src/commands/status.ts`:
  - Keep existing worktree listing logic
  - Update for new config shape (port -> base_port etc.)
  - Remove `any` types
- [ ] Delete `src/commands/dev.ts`
- [ ] Delete `src/commands/doctor.ts`
- [ ] Update `src/cli.ts` to register new commands: up, down, run, refresh, status
- [ ] Extract `resolveFeature()` from down.ts into `src/lib/detect.ts` (shared by down and run)

#### Testing

`bun run typecheck` passes. `bun run build` succeeds. `./dist/wt --help` shows: up, down, run, refresh, status. `./dist/wt run --help` works.

Covers: CLI (up, down, run, refresh, status), Hooks (all lifecycle events), Removed Features.

#### Files Changed

| File | Changes |
|------|---------|
| `src/commands/up.ts` | Rewrite with hooks and scripts |
| `src/commands/down.ts` | Rewrite with hooks and scripts |
| `src/commands/run.ts` | New file: custom command dispatcher |
| `src/commands/refresh.ts` | New file: fetch main branch |
| `src/commands/status.ts` | Update for new config, fix types |
| `src/commands/dev.ts` | Delete |
| `src/commands/doctor.ts` | Delete |
| `src/cli.ts` | Update subcommand registration |
| `src/lib/detect.ts` | Add shared resolveFeature() |

---

### Phase 3: Avatar Config Migration & Scripts

**Status:** completed
**Dependencies:** Phase 1

#### Summary

Migrate avatar's `.wt/config.yaml` to the new format and create the project scripts that replace the built-in dev/doctor functionality.

#### Tasks

- [ ] Rewrite `/Users/kgonyon/Projects/avatar/.wt/config.yaml` with new format:
  - `port:` instead of `ports:`, matching ramp naming
  - `scripts:` with setup and cleanup paths
  - `commands:` with dev and doctor entries
  - `env_files:` for API and UI packages
  - `hooks:` section (empty initially)
  - Remove `services`, `setup`, `packages` keys
- [ ] Create `/Users/kgonyon/Projects/avatar/.wt/scripts/setup.sh`:
  - `bun install` in worktree root (bun workspaces handles both packages)
  - Print summary
- [ ] Create `/Users/kgonyon/Projects/avatar/.wt/scripts/cleanup.sh`:
  - Placeholder with cleanup instructions
- [ ] Create `/Users/kgonyon/Projects/avatar/.wt/scripts/dev.sh`:
  - Port ramp's `dev.sh` pattern: colored output, log files, signal handling
  - Run API migrations, start API and UI dev servers
  - Use `WT_FEATURE_DIR`, `WT_PORT_1`, `WT_PORT_2` env vars
- [ ] Create `/Users/kgonyon/Projects/avatar/.wt/scripts/doctor.sh`:
  - Check bun, git, wrangler installed
  - Check env files exist
  - Check node_modules exist
- [ ] Update avatar `.gitignore` if needed for `.wt/port_allocations.json` and tree artifacts

#### Testing

Config parses without errors. Scripts are executable (`chmod +x`). `wt doctor` equivalent works via `wt run doctor`.

Covers: Config (project config loaded), CLI (wt run dev, wt run doctor work with avatar scripts).

#### Files Changed

| File | Changes |
|------|---------|
| `/Users/kgonyon/Projects/avatar/.wt/config.yaml` | Rewrite with new format |
| `/Users/kgonyon/Projects/avatar/.wt/scripts/setup.sh` | New file |
| `/Users/kgonyon/Projects/avatar/.wt/scripts/cleanup.sh` | New file |
| `/Users/kgonyon/Projects/avatar/.wt/scripts/dev.sh` | New file |
| `/Users/kgonyon/Projects/avatar/.wt/scripts/doctor.sh` | New file |

#### Notes

- Avatar is a monorepo (single git repo), not multi-repo like ramp. So `WT_FEATURE_DIR` points to `trees/<feature>` which contains the full monorepo, not individual repos.
- Env files reference `packages/api/.env.example` etc. within the worktree.

---

### Phase 4: End-to-End Validation

**Status:** completed
**Dependencies:** Phase 2, Phase 3

#### Summary

Build the wt binary, verify all commands work, and validate against the avatar config.

#### Tasks

- [ ] Run `bun run typecheck` in wt project — must pass
- [ ] Run `bun run build` in wt project — must produce `dist/wt`
- [ ] Verify `./dist/wt --help` shows: up, down, run, refresh, status
- [ ] Verify `./dist/wt up --help` shows feature argument
- [ ] Verify `./dist/wt run --help` shows command argument
- [ ] Copy `dist/wt` to PATH or test with full path from avatar project
- [ ] Run `wt status` from avatar root — should show no features (or existing ones)
- [ ] Run `wt refresh` from avatar root — should fetch main
- [ ] Verify removed commands: `wt dev` and `wt doctor` should not exist

#### Testing

Full end-to-end CLI validation. All acceptance criteria verified.

#### Files Changed

| File | Changes |
|------|---------|
| (no file changes — validation only) | |

---

## Reviews

### Round 1

**Accepted:**
- Q1 (quality): Duplication — mergeHooks duplicated in config.ts and hooks.ts. Consolidated into hooks.ts.
- A1 (architecture): Plan compliance — default command scope inverted vs spec. Fixed ternary in run.ts.
- A2 (architecture): Separation — hooks use featureDir as cwd but dir doesn't exist for pre_up/post_down. Added cwd param.
- S1 (security): Command injection — unquoted path in sh -c. Changed to direct Bun.spawn for scripts.
- S2 (security): Path traversal — no validation on script path. Added .wt/ prefix check.
- S3 (security): YAML injection — no type validation on hook commands. Added string[] validation.
- Q7/A4 (quality/architecture): Inline import() type in down.ts. Fixed to top-level import type.

**Rejected:**
- Q2/A5: lookupPorts duplication — different error semantics justify separate implementations.
- Q3: ScriptContext construction — different data flows in each command.
- Q4: runScript/runCommand shared logic — file is 68 lines, minimal gain.
- Q5/A6: loadAllHooks re-reads files — negligible cost, independence is intentional.
- Q6: applyReplacements loop vs .map() — stylistic preference.
- S4: Environment leakage — spec requires full env inheritance for scripts.
- S5: User config privilege — same trust model as .gitconfig, documented design.
- S6: No schema validation — yaml package is safe, zod is feature enhancement.

### Round 2

**Accepted:**
- Q2 (quality): Inconsistent basePort fallback — added `?? 0` to up.ts for consistency.
- Q3 (quality): Hardcoded hook events — derived from HOOK_EVENTS const array to prevent drift.

**Rejected:**
- Q1: lookupPorts duplication — same as Round 1, no new evidence.
