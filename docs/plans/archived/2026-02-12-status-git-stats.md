# Spec: Show git change stats in `wt status`

**Date:** 2026-02-12
**Status:** shipped

## Summary

Replace the binary `dirty`/`clean` indicator in `wt status` with meaningful git change statistics. Each feature tree will display the number of changed files (tracked + untracked) and total line insertions/deletions for tracked changes. This gives developers an at-a-glance understanding of how much work is in-flight across their worktrees without needing to `cd` into each one.

## Technical Specification

- **Stack:** TypeScript / Bun, citty CLI framework, consola logging
- **New Dependencies:** None

## Key Decisions

- **Single display format:** Show `N changed  +X -Y` for dirty trees, `clean` for clean trees. No verbose/compact toggle — keep it simple.
- **Include untracked in file count:** Untracked files count toward the `N changed` number since they represent real work-in-progress. They won't contribute to `+X -Y` line counts since git doesn't diff untracked files.
- **Two git commands per worktree:** `git status --porcelain` (file count, already called) + `git diff HEAD --numstat` (line counts for tracked changes). The porcelain call replaces the existing `isWorktreeDirty` call, so net cost is one additional command per tree.
- **Preserve `isWorktreeDirty` contract:** The `refresh` command uses the dirty boolean. Provide an `isDirty` field on the new stats interface so callers can still check a boolean without changing their logic.
- **Pure parsing functions:** All git output parsing is extracted into `@internal` exported pure functions for easy unit testing, following the existing `parsePorcelainOutput` / `parseSingleBlock` pattern.
- **No colors in v1:** Keep plain text output consistent with the existing status format. Colors can be added later.

## In Scope

- New `WorktreeStats` interface with file count, insertions, deletions, isDirty
- New `getWorktreeStats()` async function replacing `isWorktreeDirty()` for status
- New `parsePorcelainFileCount()` pure function to count files from porcelain output
- New `parseNumstatOutput()` pure function to sum insertions/deletions from numstat output
- New `formatStats()` pure function for display formatting
- Updated `printFeatureStatus()` to display stats
- Updated `refresh.ts` to use `getWorktreeStats().isDirty` instead of `isWorktreeDirty()`
- Removal of `isWorktreeDirty()` after migration
- Unit tests for all new pure functions
- Updated status.test.ts with tests for `formatStats()`

## Out of Scope

- Color-coded output (follow-up)
- `--verbose` flag for expanded detail
- Ahead/behind commit counts relative to upstream
- Staged vs unstaged breakdown (all changes are aggregated)
- Table/columnar layout for status output
- Caching or parallel git command execution
- Live watch mode

## Acceptance Criteria

### CLI Output

- [ ] `wt status` shows `N changed  +X -Y` for dirty feature trees where N is total files (tracked + untracked), X is total insertions, Y is total deletions
- [ ] `wt status` shows `clean` for feature trees with no changes
- [ ] `wt status` shows `0 changed  +0 -0` is never displayed (clean is shown instead)
- [ ] `wt refresh` still blocks on dirty worktrees with the same error message

### Parsing

- [ ] `parsePorcelainFileCount` correctly counts modified, added, deleted, renamed, and untracked files
- [ ] `parsePorcelainFileCount` returns 0 for empty output
- [ ] `parsePorcelainFileCount` handles all git status XY code combinations
- [ ] `parseNumstatOutput` correctly sums insertions and deletions across files
- [ ] `parseNumstatOutput` returns `{ insertions: 0, deletions: 0 }` for empty output
- [ ] `parseNumstatOutput` handles binary files (shown as `-\t-\t` in numstat) by skipping them

### Error Handling

- [ ] If `git status --porcelain` fails, stats show `clean` (same fallback as current behavior)
- [ ] If `git diff HEAD --numstat` fails, file count still shows but line counts show `+0 -0`

---

## Test Plan

### Git output parsing

**File:** `src/lib/git.test.ts`

- `describe parsePorcelainFileCount`
  - `it returns 0 for empty string` — verifies empty output produces a count of 0
  - `it returns 0 for whitespace-only output` — verifies blank lines and spaces are treated as empty
  - `it counts a single modified file` — parses ` M file.ts` and returns 1
  - `it counts a single added file` — parses `A  file.ts` and returns 1
  - `it counts a single deleted file` — parses ` D file.ts` and returns 1
  - `it counts a renamed file` — parses `R  old.ts -> new.ts` and returns 1
  - `it counts untracked files` — parses `?? file.ts` and returns 1
  - `it counts mixed tracked and untracked files` — parses output with M, A, D, ??, R lines and returns correct total
  - `it handles staged and unstaged changes to the same file as one file` — parses `MM file.ts` (modified in index and worktree) and returns 1
  - `it handles all two-character XY status codes` — verifies codes like `AM`, `AD`, `UU` (merge conflict) each count as one file
  - `it counts multiple untracked files` — parses several `??` lines and returns correct count
  - `it ignores ignored files` — verifies `!! ignored.ts` lines (from `--ignored`) are not counted if present

- `describe parseNumstatOutput`
  - `it returns zeros for empty string` — verifies empty output produces `{ insertions: 0, deletions: 0 }`
  - `it returns zeros for whitespace-only output` — verifies blank lines produce zeros
  - `it sums insertions and deletions for a single file` — parses `10\t5\tfile.ts` and returns `{ insertions: 10, deletions: 5 }`
  - `it sums across multiple files` — parses multi-line numstat output and returns combined totals
  - `it skips binary files shown as dashes` — parses `-\t-\timage.png` and returns zeros for that entry
  - `it handles mix of binary and text files` — parses output with both text diffs and binary markers, only sums the text diffs
  - `it handles file with zero insertions` — parses `0\t5\tfile.ts` correctly
  - `it handles file with zero deletions` — parses `5\t0\tfile.ts` correctly
  - `it handles large numbers` — parses `9999\t8888\tfile.ts` and returns correct sums without overflow

### Stats display formatting

**File:** `src/commands/status.test.ts`

- `describe formatStats`
  - `it returns "clean" when isDirty is false` — verifies clean worktrees display as `clean` regardless of other fields
  - `it returns "clean" for zero file count with zero changes` — verifies `{ fileCount: 0, insertions: 0, deletions: 0, isDirty: false }` returns `clean`
  - `it returns formatted string for dirty worktree` — verifies `{ fileCount: 3, insertions: 10, deletions: 5, isDirty: true }` returns `3 changed  +10 -5`
  - `it formats single file with only insertions` — verifies `{ fileCount: 1, insertions: 7, deletions: 0, isDirty: true }` returns `1 changed  +7 -0`
  - `it formats single file with only deletions` — verifies `{ fileCount: 1, insertions: 0, deletions: 12, isDirty: true }` returns `1 changed  +0 -12`
  - `it formats untracked-only changes with zero line counts` — verifies `{ fileCount: 2, insertions: 0, deletions: 0, isDirty: true }` returns `2 changed  +0 -0` (untracked files have no diff)
  - `it never returns "0 changed  +0 -0"` — verifies that a stats object with fileCount 0 and isDirty false returns `clean`, not `0 changed  +0 -0`
  - `it formats large numbers correctly` — verifies `{ fileCount: 42, insertions: 1500, deletions: 800, isDirty: true }` returns `42 changed  +1500 -800`
  - `it uses double-space separator between changed and counts` — verifies the output contains two spaces between `N changed` and `+X`

### Error handling in getWorktreeStats

**File:** `src/lib/git.test.ts`

- `describe getWorktreeStats`
  - `it returns clean stats when git status --porcelain fails` — mocks a failing `git status` and verifies `isDirty` is false with zero counts
  - `it returns file count with zero line counts when git diff HEAD --numstat fails` — mocks a failing `git diff` but successful `git status`, verifies `fileCount` is set but `insertions` and `deletions` are 0
  - `it returns full stats when both commands succeed` — mocks both commands succeeding and verifies all fields are populated correctly

---

## Phases

### Phase 1: Git stats parsing

**Status:** completed
**Dependencies:** None

#### Summary

Add the core data layer: a `WorktreeStats` interface and pure parsing functions that extract file counts and line change stats from git porcelain and numstat output. This phase is all `src/lib/git.ts` changes with full test coverage.

#### Tasks

- [x] Add `WorktreeStats` interface to `src/lib/git.ts` with fields: `fileCount`, `insertions`, `deletions`, `isDirty`
- [x] Add `parsePorcelainFileCount(output: string): number` — count unique files from `git status --porcelain` output
- [x] Add `parseNumstatOutput(output: string): { insertions: number; deletions: number }` — sum line changes from `git diff HEAD --numstat` output
- [x] Add `getWorktreeStats(treePath: string): Promise<WorktreeStats>` — runs both git commands and returns combined stats
- [x] Add unit tests for `parsePorcelainFileCount`: empty output, single file, multiple files, untracked, renamed, mixed statuses
- [x] Add unit tests for `parseNumstatOutput`: empty output, single file, multiple files, binary files (dash-dash)

#### Testing

Verify parsing acceptance criteria: run `bun test src/lib/git.test.ts` and confirm all new tests pass.

#### Files Changed

| File | Changes |
|------|---------|
| `src/lib/git.ts` | Add `WorktreeStats` interface, `parsePorcelainFileCount`, `parseNumstatOutput`, `getWorktreeStats` |
| `src/lib/git.test.ts` | Add test suites for `parsePorcelainFileCount` and `parseNumstatOutput` |

---

### Phase 2: Status display update

**Status:** completed
**Dependencies:** Phase 1

#### Summary

Update the status command to use `getWorktreeStats()` instead of `isWorktreeDirty()` and format the stats for display. Add the `formatStats` pure function and wire it into `printFeatureStatus`.

#### Tasks

- [x] Add `formatStats(stats: WorktreeStats): string` to `src/commands/status.ts` — returns `N changed  +X -Y` or `clean`
- [x] Update `printFeatureStatus` to call `getWorktreeStats()` instead of `isWorktreeDirty()`
- [x] Update the Status line to use `formatStats()`
- [x] Update import in `status.ts` from `isWorktreeDirty` to `getWorktreeStats`
- [x] Add unit tests for `formatStats`: clean stats, dirty stats, zero line changes with untracked files, large numbers

#### Testing

Verify CLI output acceptance criteria: run `bun test src/commands/status.test.ts` and confirm all new tests pass.

#### Files Changed

| File | Changes |
|------|---------|
| `src/commands/status.ts` | Add `formatStats`, update `printFeatureStatus` to use `getWorktreeStats` |
| `src/commands/status.test.ts` | Add test suite for `formatStats` |

---

### Phase 3: Migrate callers and clean up

**Status:** completed
**Dependencies:** Phase 2

#### Summary

Update `refresh.ts` to use `getWorktreeStats()` instead of `isWorktreeDirty()`, then remove the now-unused `isWorktreeDirty` function from `git.ts`.

#### Tasks

- [x] Update `refresh.ts` to import `getWorktreeStats` instead of `isWorktreeDirty`
- [x] Update dirty check in `refresh.ts` to use `(await getWorktreeStats(root)).isDirty`
- [x] Remove `isWorktreeDirty` function from `src/lib/git.ts`
- [x] Run full test suite to confirm nothing is broken

#### Testing

Run `bun test` (full suite) and confirm all tests pass. Verify that `isWorktreeDirty` is no longer exported or referenced anywhere.

#### Files Changed

| File | Changes |
|------|---------|
| `src/commands/refresh.ts` | Replace `isWorktreeDirty` import/usage with `getWorktreeStats` |
| `src/lib/git.ts` | Remove `isWorktreeDirty` function |

---

## Reviews

### Review Findings

| # | File:Line | Category | Severity | Description | Suggested Fix |
|---|-----------|----------|----------|-------------|---------------|
| Q1 | src/lib/git.ts:124-125 | Quality | Med | `Number()` on malformed numstat input silently produces NaN, corrupting entire sum | Use `Number.parseInt` with NaN guard |
| Q2 | src/lib/git.ts:2 | Quality | Low | Unused import `consola` (pre-existing, not introduced by this branch) | Remove the import |
| A1 | src/lib/git.test.ts | Architecture | Med | Spec test plan defines 3 `getWorktreeStats` error-handling tests but none implemented | Add tests per test plan |

### Review Decision

#### Accepted

| # | File:Line | Category | Rationale |
|---|-----------|----------|-----------|
| Q1 | src/lib/git.ts:124-125 | Quality | Silent NaN corruption violates AGENTS.md "prefer loud" principle. Minimal, behavior-preserving hardening. |
| A1 | src/lib/git.test.ts | Architecture | Spec mandates these tests. Two catch blocks with zero coverage. |

#### Rejected

| # | File:Line | Category | Rationale |
|---|-----------|----------|-----------|
| Q2 | src/lib/git.ts:2 | Quality | Pre-existing on main, not introduced by this branch. Should be a separate cleanup. |

#### Summary
- Accepted: 2 findings
- Rejected: 1 finding
- Both accepted findings implemented and verified (133 tests passing)
