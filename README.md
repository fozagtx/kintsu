# Ratchet

Ratchet runs Kane CLI in a real browser every time your coding agent says it is done, and turns each bug Kane catches into a check committed to the repo.

## What is it?

Ratchet adds four parts to an agent's coding loop:

1. **Stop hook.** Runs `ratchet verify` when the agent tries to stop. Required.
2. **Kane replay.** Replays the saved browser flow for each area the change touched, with healing off. Required. You need a Kane account.
3. **Check writer.** After a red flow goes green, it reads the fix and writes one deterministic check: a unit test, an ESLint rule, or a smoke promotion of the Kane flow.
4. **Proof.** Shows the check passes on the fixed code and fails when the bad code is put back. No browser, no credits.

The agent writes the fixes. Ratchet decides whether the agent may stop, and writes and commits the checks.

## How it works

```text
              AGENT SAYS DONE
                    |
                    v
          +-------------------+
          |   LOCKED CHECKS   |-- fail --> stop blocked
          +-------------------+            (0 credits, Kane not run)
                    | pass
                    v
          +-------------------+
          |   KANE REPLAY     |
          |   healing off     |
          +-------------------+
             |             |
            red          green
             |             |
             v             v
     stop blocked     was this flow red before?
     agent gets             |
     run_end, remark,      yes
     evidence path          |
             |              v
             |      +-------------------+
             |      |   WRITE ONE CHECK |
             |      +-------------------+
             |              |
             |              v
             |      +-------------------+
             |      |   PROVE IT        |-- fails --> undo it, promote
             |      |   no browser      |             the Kane flow to smoke
             |      +-------------------+
             |              |
             v              v
      agent fixes,       commit fix + check + receipt
      stops again        (never pushed)
```

The agent gets three red cycles in a row. After the third, it may stop and the failure goes to you. If Kane cannot start (exit 2) or times out (exit 3), the stop is not blocked.

## Why use it?

- A bug the browser caught once is caught by a test or lint rule from then on, before Kane even runs.
- Reintroducing a locked bug costs 0 credits. The check blocks it.
- The agent cannot pass by rewording the objective or editing the saved Kane test. Both are hashed.
- Every check ships with a receipt: the failing `run_end`, the evidence pack, the bad diff, the fix diff, and the proof result.

Results depend on how well the saved flow covers your app and on which check type fits the failure. Some failures only qualify for the smoke promotion, which is still a browser replay.

## Install

```bash
git clone https://github.com/fozagtx/Rachet.git ratchet
cd ratchet
npm run setup
```

`npm run setup` runs `npm install`, installs `@testmuai/kane-cli@0.10.4` globally, and runs `kane-cli login`. Use `kane-cli login --oauth` for browser sign-in. Requires Node 20+, git, and Chrome.

## Quick start

Full loop in a throwaway clone. The script applies a reverse patch in place of the agent's fix, so your checkout is not touched:

```text
bash scripts/demo.sh
```

Real loop with an agent. Open the repo in Claude Code. The Stop hook is already registered in `.claude/settings.json`. Plant a bug, ask the agent for any change in `demo-app/`, and let it stop:

```text
npm run plant:dropped-field
```

Manual run, no agent:

```text
npm run plant:dropped-field
npm run verify
```

## Configure flows

Flows live in `.ratchet/config.json`:

```json
{
  "name": "signup",
  "objective": "Open the signup page. Enter Ada Lovelace ... verify the welcome message says Ada Lovelace is on the Pro plan.",
  "test": ".testmuai/tests/signup_test.md",
  "paths": ["demo-app/"]
}
```

- `name` must match `[A-Za-z0-9_-]+`. It becomes Kane's `--name`.
- `objective` is one task, under about 15 steps.
- `paths` decides which changes trigger this flow.
- `handlers` (top level) lists functions that receive form data. Ratchet writes unit tests against these.
- `lint.files` (top level) lists the directories the ESLint rules cover.

Author each flow once, on the clean app:

```text
node bin/ratchet.js author signup
node bin/ratchet.js author signup-terms
```

This saves `.testmuai/tests/<name>_test.md` and locks the objective and steps in `.ratchet/flows.lock.json`. Commit both. Later replays run from cache, with no model cost.

## Check types

- **Control looked disabled but still fired.** Writes an ESLint `no-restricted-syntax` rule built from the exact line the fix removed, into `eslint.config.js`.
- **Server accepted the request but dropped a field.** Writes a unit test in `tests/ratchet/` that sends every form field through the handler and asserts each one is stored.
- **Value sent empty or as the wrong type.** A narrower type check is planned and not built. Ratchet records the signal and moves on to the next check type.
- **Anything else.** Adds the `smoke` tag to the saved Kane flow's frontmatter.

The reason for each choice is recorded in `.ratchet/<bug-id>.json`.

## Useful commands

```text
ratchet verify [--hook]   locked checks, then Kane on touched flows (what the hook runs)
ratchet author <flow>     author a flow once with Kane and lock it
ratchet lock              replay pending red flows, lock the ones now green
ratchet prove [bug-id]    put the bad code back in a temp worktree, show the check blocks it
ratchet check             run every locked check
ratchet smoke             replay every smoke-tagged flow, healing off
ratchet status            pending bugs and locked checks
```

Run them as `node bin/ratchet.js <command>`, or link the CLI with `npm link`.

To open an evidence pack:

```text
kane-cli evidence serve .ratchet/evidence/<bug-id>.evidence
```

## Important limits

- Ratchet never writes `AGENTS.md` or `CLAUDE.md`. When no deterministic check fits, it promotes the Kane flow to smoke. It never writes prose rules.
- Replays always run with `--no-adaptive-heal`.
- Locked checks only get stricter. Deleting or editing one blocks the stop.
- A check is kept only if its proof holds. If it fails, Ratchet undoes the check and falls back to the smoke promotion.
- Ratchet commits locally and never pushes or merges.
- A flow that goes green with no code change is treated as flaky. No check is written.
- Single repo, desktop web only. No dashboard and no mobile targets.

## Demo app

`demo-app/` is one signup form: name, email, plan, a terms checkbox, and a Create account button. It ships clean. Two bugs are stored as patches:

- `dropped-field.patch`: the handler reads `payload.planId` instead of `payload.plan`, so every Pro signup lands on Free. Ratchet writes a unit test on `createAccount`.
- `fake-disabled.patch`: the button gets a grey `is-disabled` class but is never disabled, so you can sign up without accepting the terms. Ratchet writes an ESLint rule.

```text
npm run app                    serves http://localhost:4310
npm run plant:fake-disabled    applies the second bug
```

## Update

The Kane version is pinned in `npm run setup` so a release mid-build cannot change behaviour. To upgrade, change the version there, reinstall, and re-author your flows if the saved test format changed.

## Uninstall

Remove the `Stop` entry from `.claude/settings.json` first, then delete the repo. `.ratchet/` receipts and the checks in `tests/ratchet/` and `eslint.config.js` stay in your git history.

## Development

```bash
npm install
npm test        # unit tests for the classifier and check writer
npm run lint    # runs the locked ESLint rules on demo-app/
```
