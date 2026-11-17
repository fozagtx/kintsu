---
tags: [seam, confirmation]
mode: testing
max_steps: 50
timeout: 180
target: chrome
headless: true
local_context: >-
  # Kintsu Shop


  - Runs at http://localhost:3000. No login.

  - One product: Kintsu Mug, $40.00, at /product/mug.

  - Cart at /cart: quantity, a coupon code field with an Apply coupon button,
  and an Add gift wrap ($5.00) checkbox.

  - Checkout at /checkout shows Merchandise, Discount, Gift wrap, Tax and Total,
  and a Pay button.

  - Confirmation at /confirmation shows Total paid.

  - Money is shown in dollars with two decimals.
---

# Session: confirmation-matches-checkout

## Step 1
Go to http://localhost:3000. Open the $40 mug and click Add to cart. Type SAVE10 into the coupon code field and click Apply coupon. Tick the Add gift wrap checkbox. Click Go to checkout. On the checkout page, store the total as 'total'. Click the Pay button. On the confirmation page, store the total paid as 'paid'. Then verify that the stored paid equals the stored total.
