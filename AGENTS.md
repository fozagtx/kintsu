# Working in this repo

This repo is Kintsu and its demo shop. If you are a coding agent working on a repair ticket from Kintsu, follow these rules.

- Only edit the files your ticket says you own.
- Fix the product code. Never edit the Kane objective, `agents/`, `tests/` or `docs/`.
- Do not run Kane yourself. Kintsu reruns the exact same Kane command after you finish.
- Read `docs/pricing-rules.md` before changing any prices or totals.
- Do not add code comments.
- When you finish, reply with one paragraph that says what was wrong and what you changed.

To check the running app in a browser, use Kane CLI (`kane-cli run "<objective>" --agent --headless`), not Playwright.
