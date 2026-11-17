#!/usr/bin/env bash
# Claude Code Stop hook. The hook JSON arrives on stdin and is passed through.
# Exit 2 blocks the stop and hands stderr (the Kane failure) to the agent.
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}" || exit 0
exec node bin/ratchet.js verify --hook
