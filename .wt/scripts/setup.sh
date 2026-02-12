#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# Setup script — runs after worktree creation and env file generation
# during `wt up <feature>`.
#
# Available environment variables:
#   WT_PROJECT      — Project name from config
#   WT_PROJECT_DIR  — Absolute path to the project root
#   WT_FEATURE      — Feature name (e.g., "my-feature")
#   WT_FEATURE_DIR  — Absolute path to the feature worktree
#   WT_PORT         — First allocated port (alias for WT_PORT_1)
#   WT_PORT_1       — First allocated port
#   WT_PORT_2       — Second allocated port
#   WT_PORT_N       — Nth port (up to per_feature)
#
# Working directory is set to the feature worktree.
# ------------------------------------------------------------------

echo "Setting up feature: $WT_FEATURE"

# Example: Install dependencies
# npm install

# Example: Run database migrations
# npm run db:migrate

# Example: Seed test data
# npm run db:seed
