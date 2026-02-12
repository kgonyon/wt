#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------
# Cleanup script — runs before worktree removal during `wt down`.
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

echo "Cleaning up feature: $WT_FEATURE"

# Example: Drop feature database
# dropdb "myapp_${WT_FEATURE}" --if-exists

# Example: Remove temporary files
# rm -rf tmp/

# Example: Stop any running services
# docker compose down
