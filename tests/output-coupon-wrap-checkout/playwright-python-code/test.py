import os
import testmu
from testmu import expect, var, set_var
from playwright.async_api import Page

testmu.configure(
    build="5f26c858-1411-4d1b-8ede-dc2c80d2791e",
    name="Validate Discount and Fees on Checkout",
    tc_id="TC-20",
    network=os.getenv("NETWORK", "false").lower() == "true",
    variables={"merch": "$40.00", "discount": "$4.00", "wrap": "$5.00", "tax": "$4.10", "total": "$45.10", "discount_percentage_check": "$4.00", "wrap_fee_check": "$5.00", "total_calculation_check": "$45.10"},
    auto_heal_version="AH2",
    default_action_timeout_ms=60000,
    default_navigation_timeout_ms=60000,
    kane_run_v4=True,
)

@testmu.test
async def test(page: Page):
    async with testmu.step('Navigate to http://localhost:3000', instruction_id='20827a7c-60a0-40ec-a027-9848117b55b5'):
        await page.goto("http://localhost:3000")
    
    async with testmu.step('Clicking View the $40.00 mug', instruction_id='b9177ee8-a9ce-4e34-91b1-544b2a71342b'):
        _loc_1 = page.locator("internal:role=link[name=\"View the $40.00 mug\"i]")
        
        await _loc_1.click()
    
    async with testmu.step('Clicking Add to cart', instruction_id='380f3e5f-dcff-42b3-80fa-c64c15636c3f'):
        _loc_2 = page.locator("internal:role=button[name=\"Add to cart\"i]")
        
        await _loc_2.click()
    
    async with testmu.step('Waiting for the coupon code to be applied', instruction_id='35e315b1-67cc-4118-8e7c-76251cc93f1a'):
        await page.wait_for_timeout(1000)
    
    async with testmu.step('Type "SAVE10" into "Coupon code"', instruction_id='193d1ae7-6844-4ae4-b62f-7a17f581b262'):
        element_0 = page.locator("internal:role=textbox[name=\"Coupon code\"i]")
        
        await testmu.fill(element_0, "SAVE10")
    
    async with testmu.step('Click "Apply coupon"', instruction_id='e9c4680f-c777-41cb-83a1-1147e050131a'):
        _loc_3 = page.locator("internal:role=button[name=\"Apply coupon\"i]")
        
        await _loc_3.click()
    
    async with testmu.step('Checking the applied coupon status', instruction_id='4fe495f7-2cc3-470a-8d25-356b83db136b'):
        await page.wait_for_timeout(500)
    
    async with testmu.step('Clicking the Add gift wrap checkbox', instruction_id='e0012f61-5171-47f0-a3d3-cba07e729967'):
        _loc_4 = page.locator("internal:role=checkbox[name=\"Add gift wrap ($5.00)\"i]")
        
        await _loc_4.click()
    
    async with testmu.step('Clicking Go to checkout in cart', instruction_id='b63edf56-6c53-4eb4-afed-bcc6053918f3'):
        _loc_5 = page.locator("internal:role=link[name=\"Go to checkout\"i]")
        
        await _loc_5.click()
    _condition_met = False
    _until_retries = 0
    while _until_retries < 10:
        print(f"[until-loop] iteration {_until_retries + 1}/10")
        async with testmu.step('Waiting for the Checkout heading to be visible', instruction_id='4d708d06-18db-4125-9db0-0ee92de92cb4'):
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(500)
        if await testmu.check_until_condition(page, "the heading 'Checkout' is visible"):
            _condition_met = True
            break
        _until_retries += 1
    set_var("__result__", {"condition_met": _condition_met, "retries": _until_retries + 1})
    
    async with testmu.step('Reading the merchandise amount from the checkout summary'):
        set_var('merch', await testmu.textual_analyzer(page, wrapped_js="(els) => {\n  const __m = {4: 0};\n  const el = (i) => els[__m[i]];\n  const __v = (el(4).querySelectorAll('.row')[0].querySelectorAll('span')[1].textContent.trim());\n  return (typeof __v === 'boolean' ? String(__v) : __v);\n}", locators=['internal:text="CheckoutMerchandise$40."i'], query='the merchandise amount in the checkout summary', expected_value='', needs_unit_conversion=False, operator='equals', transforms=['strip'], condition='The merchandise amount on the checkout page is saved as {{merch}}.'))
    
    async with testmu.step('Reading the discount amount from the checkout summary'):
        set_var('discount', await testmu.textual_analyzer(page, wrapped_js="(els) => {\n  const __m = {4: 0};\n  const el = (i) => els[__m[i]];\n  const __v = (el(4).querySelectorAll('.row')[1].querySelectorAll('span')[1].textContent.trim().replace(/^-/,''));\n  return (typeof __v === 'boolean' ? String(__v) : __v);\n}", locators=['internal:text="CheckoutMerchandise$40."i'], query='the discount amount without its minus sign in the checkout summary', expected_value='', needs_unit_conversion=False, operator='equals', transforms=['strip'], condition='The discount amount as a positive number without the minus sign on the checkout page is saved as {{discount}}.'))
    
    async with testmu.step('Reading the gift wrap fee from the checkout summary'):
        set_var('wrap', await testmu.textual_analyzer(page, wrapped_js="(els) => {\n  const __m = {4: 0};\n  const el = (i) => els[__m[i]];\n  const __v = (el(4).querySelectorAll('.row')[2].querySelectorAll('span')[1].textContent.trim());\n  return (typeof __v === 'boolean' ? String(__v) : __v);\n}", locators=['internal:text="CheckoutMerchandise$40."i'], query='the gift wrap fee in the checkout summary', expected_value='', needs_unit_conversion=False, operator='equals', transforms=['strip'], condition='The gift wrap fee on the checkout page is saved as {{wrap}}.'))
    
    async with testmu.step('Reading the tax amount from the checkout summary'):
        set_var('tax', await testmu.textual_analyzer(page, wrapped_js="(els) => {\n  const __m = {4: 0};\n  const el = (i) => els[__m[i]];\n  const __v = (el(4).querySelectorAll('.row')[3].querySelectorAll('span')[1].textContent.trim());\n  return (typeof __v === 'boolean' ? String(__v) : __v);\n}", locators=['internal:text="CheckoutMerchandise$40."i'], query='the tax amount in the checkout summary', expected_value='', needs_unit_conversion=False, operator='equals', transforms=['strip'], condition='The tax on the checkout page is saved as {{tax}}.'))
    
    async with testmu.step('Reading the total from the checkout summary'):
        set_var('total', await testmu.textual_analyzer(page, wrapped_js="(els) => {\n  const __m = {4: 0};\n  const el = (i) => els[__m[i]];\n  const __v = (el(4).querySelector('.row.total').querySelectorAll('span')[1].textContent.trim());\n  return (typeof __v === 'boolean' ? String(__v) : __v);\n}", locators=['internal:text="CheckoutMerchandise$40."i'], query='the total amount in the checkout summary', expected_value='', needs_unit_conversion=False, operator='equals', transforms=['strip'], condition='The total on the checkout page is saved as {{total}}.'))
    
    async with testmu.step('Comparing the stored discount amount to ten percent of the merchandise amount', instruction_id='bd5c78fd-ab83-4c54-9e81-a4090e20136e'):
        set_var('discount_percentage_check', "$4.00")
    
    async with testmu.step('Comparing the stored gift wrap fee amount', instruction_id='512ee2d2-21d3-465d-a75f-23386e0a2e61'):
        set_var('wrap_fee_check', "$5.00")
    
    async with testmu.step('Comparing the stored total to the calculated checkout total', instruction_id='211922a3-228e-4537-81bf-f5aba88ee25e'):
        set_var('total_calculation_check', "$45.10")
    
    async with testmu.step('Assertion check', instruction_id='71d2fa3c-6a7b-48b6-8198-9e002207e50b'):
        await testmu.verify_assertion(page, 'Assertion check', {'operator': ['equals'], 'assertion_operands': [], 'left_operand': None, 'right_operand': None, 'operands': [], 'sub_results': [{'description': 'The stored {{discount}} equals 10 percent of the stored {{merch}}.', 'passed': True, 'operator': 'equals', 'transforms': ['extract_number'], 'json_path': None, 'expected': '4.00', 'extracted_value': '{{discount}}', 'store_key': 'discount_percentage_check', 'variable_refs': {'{{discount}}': '$4.00', '{{merch}}': '$40.00'}}, {'description': 'The stored {{wrap}} equals 5.00.', 'passed': True, 'operator': 'equals', 'transforms': ['extract_number'], 'json_path': None, 'expected': '5.00', 'extracted_value': '{{wrap}}', 'store_key': 'wrap_fee_check', 'variable_refs': {'{{wrap}}': '$5.00'}}, {'description': 'The stored {{total}} equals the stored {{merch}} minus the stored {{discount}} plus the stored {{wrap}} plus the stored {{tax}}.', 'passed': True, 'operator': 'equals', 'transforms': ['extract_number'], 'json_path': None, 'expected': '45.10', 'extracted_value': '{{total}}', 'store_key': 'total_calculation_check', 'variable_refs': {'{{total}}': '$45.10', '{{merch}}': '$40.00', '{{discount}}': '$4.00', '{{wrap}}': '$5.00', '{{tax}}': '$4.10'}}], 'sub_checks': [{'description': 'The stored {{discount}} equals 10 percent of the stored {{merch}}.', 'store_key': 'discount_percentage_check', 'expected_value': '4.00', 'extracted_value': '{{discount}}', 'operator': 'equals', 'transforms': ['extract_number']}, {'description': 'The stored {{wrap}} equals 5.00.', 'store_key': 'wrap_fee_check', 'expected_value': '5.00', 'extracted_value': '{{wrap}}', 'operator': 'equals', 'transforms': ['extract_number']}, {'description': 'The stored {{total}} equals the stored {{merch}} minus the stored {{discount}} plus the stored {{wrap}} plus the stored {{tax}}.', 'store_key': 'total_calculation_check', 'expected_value': '45.10', 'extracted_value': '{{total}}', 'operator': 'equals', 'transforms': ['extract_number']}], 'composite_operator': 'and', 'claim': 'Verify that the stored {{discount}} equals 10 percent of the stored {{merch}}, that the stored {{wrap}} equals 5.00, and that the stored {{total}} equals the stored {{merch}} minus the stored {{discount}} plus the stored {{wrap}} plus the stored {{tax}}.'})


if __name__ == "__main__":
    testmu.run(test)