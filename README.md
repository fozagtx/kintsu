# Ratchet

> Your agent writes the bug once, and once only.

Coding agents copy whatever patterns they find in the codebase. If a bug stays in the code, it comes back. Adding another line to `AGENTS.md` doesn't stop it, because nothing enforces prose. A test or a lint rule is enforced.

Ratchet turns every bug caught in a real browser into one of those.

Other tools fix the bug. Ratchet deletes the whole class of bug.

---

## Quick start

```bash
git clone https://github.com/fozagtx/Rachet.git ratchet && cd ratchet
npm run setup          # npm install, pins @testmuai/kane-cli@0.10.4, kane-cli login --oauth
bash scripts/demo.sh   # the whole loop, end to end, in a throwaway clone
```

You need Node 20+, git, Chrome, and a TestMu AI (Kane) account. Saved flows replay from cache, so after the first authoring run, replays cost no model credits.

To use the real loop, open the repo in Claude Code. The Stop hook is already registered in `.claude/settings.json`. From then on, every time the agent says it's done, Ratchet checks its work.

---

## How it works

1. **The agent stops.** The Stop hook runs `ratchet verify`.
2. **Locked checks run first.** They're deterministic and free. If one fails, the stop is blocked with `blocked at check, 0 credits`, and Kane never starts.
3. **Kane replays the saved flows** for every area the change touched. Replays run in a real browser with `--no-adaptive-heal`.
4. **Red:** Ratchet exits with code 2, so the agent can't stop. The agent gets Kane's `run_end` line, the remark, and the path to the evidence pack.
5. **The agent fixes the code.** Ratchet replays the *same* saved flow. The objective can't be reworded to get a pass.
6. **Green:** Ratchet diffs the bad code against the fix, picks one check type, and writes the check.
7. **Proof:** in a temporary git worktree, the check has to pass on the fixed code and fail once the bad code is put back. No browser runs. A check that fails either half is thrown away.
8. **Commit:** the fix, the check, and the receipt are committed together, with the evidence path in the commit message. Ratchet never pushes.

## What Kane found, and what Ratchet writes

| Kane found | Ratchet writes | Lands in |
|---|---|---|
| A control looked disabled but still fired | ESLint `no-restricted-syntax` rule, taken from the exact line the fix removed | `eslint.config.js` |
| The server accepted the request but dropped a field | Unit test that sends every form field through the handler | `tests/ratchet/` |
| A value sent empty, or as the wrong type | Narrower type on the function that sends it *(planned)* | source file |
| Anything else | The saved Kane flow is promoted to the `smoke` tag | `_test.md` frontmatter |

The classifier always returns a check and never returns prose. If nothing deterministic fits, the fallback is the smoke promotion.

## Hard rules

- **Never writes prose.** Ratchet refuses to touch `AGENTS.md` or `CLAUDE.md`.
- **The same objective, every time.** Each flow's objective and saved test steps are hashed in `.ratchet/flows.lock.json`. If either one is edited to get a pass, the stop is blocked.
- **Healing is always off for replays**, so a re-authored step can never turn a real failure into a pass.
- **Checks only get stricter.** Deleting or editing a locked check blocks the stop.
- **Checks are kept only if their proof holds.** A check must pass on the fix and fail on the bug.
- **Every check is committed** with its evidence pack path in the message.
- **No infinite loops.** After three red cycles in a row, the agent is allowed to stop and the problem goes to you.
- **Infrastructure problems never block the agent.** If Kane can't start (exit 2) or times out (exit 3), the stop goes through.

## The receipt

Every locked bug leaves a full record in the repo:

```
.ratchet/
  config.json                  flows, app, handlers, lint targets
  flows.lock.json              hashes of each objective and its saved steps
  <bug-id>.json                objective, run_end, classification, check, proof
  diffs/<bug-id>.bad.diff      the change that introduced the bug
  diffs/<bug-id>.fix.diff      the change that fixed it
  evidence/<bug-id>.evidence   the sealed Kane evidence pack
```

To open an evidence pack: `kane-cli evidence serve .ratchet/evidence/<bug-id>.evidence`

## Commands

| Command | What it does |
|---|---|
| `ratchet verify [--hook]` | Runs locked checks, then Kane on the touched flows. This is what the Stop hook runs |
| `ratchet author <flow>` | Authors a flow once with Kane, saves it, and locks its objective |
| `ratchet lock` | Replays pending red flows and locks the ones that now pass |
| `ratchet prove [bug-id]` | Puts the bad code back in a temporary worktree and shows the check blocks it |
| `ratchet check` | Runs every locked check |
| `ratchet smoke` | Replays every smoke-tagged flow with healing off |
| `ratchet status` | Shows pending bugs and locked checks |

## The demo app

`demo-app/` is one signup form: name, email, plan, a terms checkbox, and a Create account button. It ships clean, with two realistic bugs stored as patches:

| Patch | The bug | Why code review misses it | Check Ratchet writes |
|---|---|---|---|
| `dropped-field.patch` | The handler reads `payload.planId` instead of `payload.plan`, so every Pro signup lands on Free | It looks like a harmless rename, and a silent fallback hides it | Unit test on `createAccount` |
| `fake-disabled.patch` | The button gets a grey `is-disabled` class but is never actually disabled, so you can sign up without accepting the terms | It looks disabled in every screenshot | ESLint rule banning `classList.toggle('is-disabled')` |

```bash
npm run app                    # http://localhost:4310
npm run plant:dropped-field    # or plant:fake-disabled
npm run verify                 # watch Kane catch it
```

## Setting up a new flow

1. Add the flow to `.ratchet/config.json`: a `name`, an `objective` (one task, under about 15 steps), and the `paths` it covers.
2. Author it on the **clean** app: `node bin/ratchet.js author <name>`. This saves `.testmuai/tests/<name>_test.md` and locks it.
3. Commit the saved test and `.ratchet/flows.lock.json`.

## Project layout

```
bin/ratchet.js          CLI entry
src/run-kane.js         spawns kane-cli, parses NDJSON, returns a verdict
src/verify.js           the Stop hook logic
src/classify.js         maps a failure to the check it should write
src/write-check.js      writes the unit test, lint rule, or smoke tag
src/prove.js            puts the bad code back and shows the check rejecting it
src/lock.js             receipt + commit
src/store.js            reads and writes .ratchet/
.claude/hooks/stop.sh   calls ratchet verify
demo-app/               the app under test
```

## Development

```bash
npm test
```

The test suite runs the whole loop in a throwaway git repo: red, fix, lock, prove, re-block, tamper detection, and the loop guard. In those tests, `test/fixtures/fake-kane.js` stands in for kane-cli. It follows Kane's contract (NDJSON ending in `run_end`, exit codes 0/1/2/3, a sealed `.evidence` file, `--name` saving a `_test.md`) and judges each flow by calling the running demo app. The product itself always calls the real `kane-cli`.

## Out of scope

Multiple repos, a web dashboard, mobile targets, auto merge, and auto push.
