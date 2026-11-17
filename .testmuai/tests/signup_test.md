---
mode: testing
max_steps: 50
timeout: 300
target: chrome
headless: true
local_context: >-
  # Orbit demo app


  - Runs locally at http://localhost:4310 (`npm run app`). Ratchet starts it for
  you.

  - One page: a signup form with Full name, Work email, Plan (Free, Team, Pro),
  a terms checkbox, and a Create account button.

  - The Create account button must be disabled until the terms checkbox is
  ticked.

  - After a successful signup the form is replaced by a welcome message:
  "Welcome, <name>. You're on the <plan> plan."

  - No login, no external services. Data lives in memory and resets when the
  server restarts.
---

# Session: signup

## Step 1
Open the signup page. Enter Ada Lovelace as the full name and ada@example.com as the work email, choose the Pro plan, tick the terms checkbox, click Create account, and verify the welcome message says Ada Lovelace is on the Pro plan.
