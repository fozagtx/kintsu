---
test: ../coupon-wrap-checkout_test.md
status: passed
started: 2026-11-17T19:53:13.791Z
duration_s: 101.6
session_id: abc88c17-00bc-4fde-8d7f-7d6cdad2ffbe
---

# Session: coupon-wrap-checkout — Result

## Step 1 ✓ passed (101.6s)
md5: b1d7144ea6bc314e16a42a8b84686339
Go to http://localhost:3000. Open the $40 mug and click Add to cart. On the cart page, type SAVE10 into the coupon code field and click Apply coupon. Tick the Add gift wrap checkbox. Click Go to checkout. On the checkout page, store the merchandise amount as 'merch'. On the checkout page, store the discount amount as a positive number without the minus sign as 'discount'. On the checkout page, store the gift wrap fee as 'wrap'. On the checkout page, store the tax as 'tax'. On the checkout page, store the total as 'total'. Then verify that the stored discount equals 10 percent of the stored merch, that the stored wrap equals 5.00, and that the stored total equals the stored merch minus the stored discount plus the stored wrap plus the stored tax.
