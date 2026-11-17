# Kintsu

Kintsu tests the features that different coding agents built, used together the way a customer would use them, and sends each bug to the agent that built that feature.

## What is it?

When a team splits an app between several coding agents, each agent checks its own feature and its feature works. Nobody checks what happens when a customer uses two of those features together. Kintsu does that check, using Kane CLI in a real browser.

Kintsu has five parts:

1. **Task graph.** `agents/change.json` lists the features, which agent owns each one, and which tests (called seams) should run once the features are built. Required.
2. **Kane runner.** Runs each seam with Kane CLI in Chrome, reads Kane's output, and finds the evidence pack Kane saves (screenshots, logs, failure records). Required. You need a Kane account.
3. **Price and page check.** Compares the prices Kane wrote down with `docs/pricing-rules.md`. A run that Kane marks as passed but whose prices are wrong is still treated as a failure.
4. **Owner lookup.** Works out which agent should fix the bug, using the wrong prices first and then the page where the test failed (`agents/ownership.json`).
5. **Repair loop.** Sends that agent a repair ticket with Kane's evidence, waits for its fix, and reruns the exact same Kane command. It tries three times, then stops for a human.

The live graph at `http://localhost:4000` shows each agent as a box and each seam as a line: gray before it runs, red when it fails, green when it passes.

## How it works

```text
        agents finish their features
                    |
                    v
        Kane runs the seam in Chrome
                    |
                    v
     Kintsu checks Kane's prices and result
          |                         |
        fails                     passes
          |                         |
          v                         v
   find the owner agent      save the seam as a
          |                  Kane test in tests/
          v
   repair ticket to that agent
   (Kane screenshots, prices, evidence)
          |
          v
   the agent fixes its own files
          |
          v
   Kane reruns the same command
   (up to 3 times, then a human takes over)
```

If Kane could not start (exit 2), timed out (exit 3), or marked a step as broken, Kintsu treats it as a problem with the test setup and does not send a ticket to any agent.

## Install

```bash
git clone https://github.com/fozagtx/kintsu.git
cd kintsu
npm run setup
kane-cli login --oauth
```

`npm run setup` installs the shop, installs `@testmuai/kane-cli@0.10.4` globally, and adds the Kane skill for your coding agent.

Requires Node 24 or newer, Google Chrome, a TestMu AI account for Kane, and Claude Code (`claude`) for the repair agents.

## Quick start

Run the whole demo. This puts the two known bugs back into the shop, then lets Kintsu find and fix them:

```text
npm run plant
npm run graph
npm run wave
```

Open `http://localhost:4000` to watch it. A full run takes about 11 minutes: four Kane runs and two agent fixes.

Run one seam on its own:

```text
npm run seam coupon-wrap-checkout
```

Replay the saved Kane tests with healing turned off:

```text
npm run replay
```

Kintsu starts the shop on `http://localhost:3000` by itself when it is not already running. To run it yourself, use `npm run shop`.

## The demo shop

`apps/shop` sells one $40 mug. Each feature has an owner agent:

- catalog and add to cart: `catalog-agent`
- cart quantity: `cart-agent`
- the SAVE10 coupon and the shared pricing code: `coupon-agent`
- gift wrap: `giftwrap-agent`
- checkout, tax and confirmation: `checkout-agent`

`npm run plant` adds two bugs:

- With a coupon and gift wrap together, the 10 percent discount is taken off the gift wrap fee as well, so the shop charges $44.55 instead of $45.10.
- The confirmation page shows a total saved earlier in the cart, before gift wrap was added, so it says $39.60 was paid.

`npm run unplant` removes them again.

## Add your own seams

Seams live in `agents/change.json`:

```json
{
  "id": "coupon-wrap-checkout",
  "name": "Coupon + gift wrap + checkout",
  "owners": ["coupon-agent", "giftwrap-agent", "checkout-agent"],
  "after": "t-checkout",
  "tags": ["seam", "checkout"],
  "objective": "Go to http://localhost:3000. Open the $40 mug and click Add to cart. ...",
  "expected": { "merch": 40.0, "discount": 4.0, "wrap": 5.0, "tax": 4.1, "total": 45.1 }
}
```

- Write the objective as clear steps, and tell Kane to store each amount you want checked (for example "store the total as 'total'"). Kintsu compares those stored values with `expected`.
- `after` is the task that must finish before the seam runs.
- Put each page's owner in `agents/ownership.json`. The first path that matches the failed page wins, so keep `/` last.
- Write the pricing rules in `docs/pricing-rules.md`. Repair agents are told to read it.

## Use a different coding agent

Repair tickets go to Claude Code by default. To use another agent CLI:

```text
KINTSU_AGENT=codex npm run wave
```

Each ticket tells the agent which files it owns, what Kane saw, the expected prices, and where the evidence pack is. It also tells the agent not to edit the Kane objective, `agents/`, `tests/` or `docs/`.

## Where things are saved

- `tests/`: Kane tests saved after a seam passes, with Kane's recordings
- `.kintsu/kintsu.db`: every Kane run, owner decision and repair ticket (SQLite)
- `.kintsu/runs/<run>/`: step screenshots taken from Kane's evidence packs
- Kane evidence packs: `~/.testmuai/kaneai/sessions/<session>/evidence/`. Open one with `kane-cli evidence serve <path>`

To see the graph as it was at any moment of a past run, add `?at=<ISO time>` to the graph URL.

## Important limits

- Kintsu decides when a seam passes. Agents report their work and never mark the product done.
- The file list in each ticket is an instruction to the agent. Kintsu does not stop an agent from editing other files.
- Finding the owner is rule based: wrong stored prices first, then the page in `agents/ownership.json`. A human can always read the reason on the ticket and reassign it.
- In `npm run wave`, a task whose files already exist is marked complete without running an agent.
- Saved tests can be replayed with `npm run replay`. Nothing runs them automatically on each change yet.

## Development

```bash
npm run setup
npm run shop
npm run graph
npm run seam coupon-wrap-checkout
```

There is no build step for Kintsu itself. Node runs the TypeScript files in `packages/` and `apps/dashboard/` directly.
