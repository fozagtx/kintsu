---
test: ../confirmation-matches-checkout_test.md
status: failed
started: 2026-11-17T19:55:22.107Z
duration_s: 154.7
session_id: b1c77cb9-e549-428e-a625-1b9e06c25255
---

# Session: confirmation-matches-checkout — Result

## Step 1 ✗ failed (154.7s)
md5: 0982397d4cca2e99806c1b047323c28f
Reason: Final verification failed: "{{paid}} equals {{total}}."
Go to http://localhost:3000. Open the $40 mug and click Add to cart. Type SAVE10 into the coupon code field and click Apply coupon. Tick the Add gift wrap checkbox. Click Go to checkout. On the checkout page, store the total as 'total'. Click the Pay button. On the confirmation page, store the total paid as 'paid'. Then verify that the stored paid equals the stored total.
