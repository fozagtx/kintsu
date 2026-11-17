#!/usr/bin/env bash
# One-command reproduction of the whole loop with real Kane.
# Runs in a throwaway clone, so your checkout is never touched.
# The reverse patch plays the agent's fix so the script runs unattended;
# in the video the agent writes the fix itself.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-$(mktemp -d)/ratchet-demo}"
step() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
hook() { echo '{"session_id":"demo","hook_event_name":"Stop"}' | node bin/ratchet.js verify --hook; }

command -v kane-cli >/dev/null || { echo "kane-cli not found. Run: npm run setup"; exit 1; }
[ -d "$SRC/node_modules" ] || (cd "$SRC" && npm install --silent)

git clone -q "$SRC" "$WORK"
cd "$WORK"
ln -s "$SRC/node_modules" node_modules
echo "demo clone: $WORK"

step "1. Saved Kane flows (authored once, replayed from cache after)"
for f in signup signup-terms; do
  [ -f ".testmuai/tests/${f}_test.md" ] || node bin/ratchet.js author "$f"
done
git add -A && git commit -qm "demo: saved flows" || true

# Start the demo with nothing locked, so Kane goes red before the check exists.
rm -rf .ratchet/bug-*.json .ratchet/diffs .ratchet/evidence tests/ratchet
node -e "const fs=require('fs');const f='eslint.config.js';const s=fs.readFileSync(f,'utf8');fs.writeFileSync(f,s.replace(/const ratchetRules = [\s\S]*?\];/,'const ratchetRules = [];'))"
git add -A && git commit -qm "demo: start with no locked checks" || true

step "2. The agent writes the bug: the handler reads payload.planId, every signup silently lands on Free"
git apply demo-app/bugs/dropped-field.patch
git --no-pager diff --stat

step "3. Agent says done. Stop hook: Kane replays the flow in a real browser"
set +e; hook; code=$?; set -e
echo "hook exit: $code (2 = stop blocked, failure handed to the agent)"

step "4. Agent fixes the code"
git apply -R demo-app/bugs/dropped-field.patch

step "5. Stop hook again: Kane green, Ratchet writes, proves and commits one check"
hook
git --no-pager log -1 --stat

step "6. The agent writes the same bug again"
git apply demo-app/bugs/dropped-field.patch
set +e; hook; code=$?; set -e
echo "hook exit: $code (blocked at the check: no browser, 0 credits)"
git apply -R demo-app/bugs/dropped-field.patch

step "7. Proof replay from the committed receipt"
node bin/ratchet.js prove
