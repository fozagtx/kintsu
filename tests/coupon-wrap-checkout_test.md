---
tags: [seam, checkout]
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

# Session: coupon-wrap-checkout

## Step 1
Go to http://localhost:3000. Open the $40 mug and click Add to cart. On the cart page, type SAVE10 into the coupon code field and click Apply coupon. Tick the Add gift wrap checkbox. Click Go to checkout. On the checkout page, store the merchandise amount as 'merch'. On the checkout page, store the discount amount as a positive number without the minus sign as 'discount'. On the checkout page, store the gift wrap fee as 'wrap'. On the checkout page, store the tax as 'tax'. On the checkout page, store the total as 'total'. Then verify that the stored discount equals 10 percent of the stored merch, that the stored wrap equals 5.00, and that the stored total equals the stored merch minus the stored discount plus the stored wrap plus the stored tax.
