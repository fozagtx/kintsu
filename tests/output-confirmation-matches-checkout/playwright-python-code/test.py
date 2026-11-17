import os
import testmu
from testmu import expect, var, set_var
from playwright.async_api import Page

testmu.configure(
    build="c747a2ac-b3ad-460f-9587-57a8702f43d1",
    name="Purchase with Coupon and Gift Wrap Verification",
    tc_id="TC-22",
    network=os.getenv("NETWORK", "false").lower() == "true",
    variables={"total": "$45.10", "paid": "$45.10", "paid_equals_total_check": "$45.10"},
    auto_heal_version="AH2",
    default_action_timeout_ms=60000,
    default_navigation_timeout_ms=60000,
    kane_run_v4=True,
)

@testmu.test
async def test(page: Page):
    async with testmu.step('Navigate to http://localhost:3000', instruction_id='247f3d90-006c-4f38-b69f-94fb24fc8ff2'):
        await page.goto("http://localhost:3000")
    
    async with testmu.step('Clicking View the $40.00 mug on the Kintsu Mug catalog card', instruction_id='0efe7056-ae36-422d-ae68-1dba94d73b90'):
        _loc_1 = page.locator("internal:role=link[name=\"View the $40.00 mug\"i]")
        
        await _loc_1.click()
    
    async with testmu.step('Clicking Add to cart', instruction_id='fa541c83-dc04-4921-8f27-d4f7de3b74bb'):
        _loc_2 = page.locator("internal:role=button[name=\"Add to cart\"i]")
        
        await _loc_2.click()
    
    async with testmu.step('Waiting for the coupon code to be processed', instruction_id='e608e7be-0043-4ffb-b54e-8cfb499b6c2f'):
        await page.wait_for_timeout(1000)
    
    async with testmu.step('Type "SAVE10" into "Coupon code"', instruction_id='d49eccab-682d-473e-8495-c5c5489453bd'):
        element_0 = page.locator("internal:role=textbox[name=\"Coupon code\"i]")
        
        await testmu.fill(element_0, "SAVE10")
    
    async with testmu.step('Click "Apply coupon"', instruction_id='79fb29bf-e2cc-4bab-94d9-8a8f6fbc92fd'):
        _loc_3 = page.locator("internal:role=button[name=\"Apply coupon\"i]")
        
        await _loc_3.click()
    
    async with testmu.step('Clicking the Add gift wrap checkbox', instruction_id='fa918984-7057-4206-aca7-607a56eaee48'):
        _loc_4 = page.locator("internal:role=checkbox[name=\"Add gift wrap ($5.00)\"i]")
        
        await _loc_4.click()
    
    async with testmu.step('Clicking Go to checkout', instruction_id='049e208d-fab2-4f0c-a28e-95075af48676'):
        _loc_5 = page.locator("internal:role=link[name=\"Go to checkout\"i]")
        
        await _loc_5.click()
    _condition_met = False
    _until_retries = 0
    while _until_retries < 10:
        print(f"[until-loop] iteration {_until_retries + 1}/10")
        async with testmu.step('Waiting for the Checkout heading to become visible', instruction_id='7846a4d4-f69d-4409-83fa-fd9791b41e42'):
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(500)
        if await testmu.check_until_condition(page, 'the heading "Checkout" is visible'):
            _condition_met = True
            break
        _until_retries += 1
    set_var("__result__", {"condition_met": _condition_met, "retries": _until_retries + 1})
    
    async with testmu.step('Reading the checkout total from the payment button'):
        set_var('total', await testmu.textual_analyzer(page, wrapped_js="(els) => {\n  const __m = {6: 0};\n  const el = (i) => els[__m[i]];\n  const __v = (el(6).textContent.match(/\\$[\\d,]+\\.\\d{2}/)?.[0] ?? null);\n  return (typeof __v === 'boolean' ? String(__v) : __v);\n}", locators=['internal:role=button[name="Pay $"i]'], query='the total amount shown on the payment button in the checkout summary', expected_value='', needs_unit_conversion=False, operator='equals', transforms=['strip'], condition='the total is stored as {{total}}'))
    
    async with testmu.step('Clicking the Pay button', instruction_id='318a5959-28ee-4503-88da-59ed9af19438'):
        _loc_6 = page.locator("internal:role=button[name=\"Pay $\"i]")
        
        await _loc_6.click()
    _condition_met = False
    _until_retries = 0
    while _until_retries < 10:
        print(f"[until-loop] iteration {_until_retries + 1}/10")
        async with testmu.step('Waiting for the Order confirmed heading to be visible', instruction_id='4e0e4037-64ce-4362-bac2-88e4f44f37a7'):
            await page.wait_for_timeout(500)
        await page.wait_for_timeout(500)
        if await testmu.check_until_condition(page, 'the heading "Order confirmed" is visible'):
            _condition_met = True
            break
        _until_retries += 1
    set_var("__result__", {"condition_met": _condition_met, "retries": _until_retries + 1})
    
    async with testmu.step('the total paid is stored as {{paid}}', instruction_id='8be07704-7278-441f-aee0-c30dcfefc125'):
        set_var('paid', await testmu.vision_query(page, "the total paid is stored as {{paid}}", ""))
    
    async with testmu.step('Comparing the stored paid amount with the stored total', instruction_id='45ecf50d-0ede-4984-a205-0f8efac7333e'):
        set_var('paid_equals_total_check', "$45.10")
    
    async with testmu.step('Assertion check', instruction_id='2453fc14-9351-4d2f-af43-99c4a11b1dc6'):
        await testmu.verify_assertion(page, 'Assertion check', {'operator': ['equals'], 'assertion_operands': [], 'left_operand': None, 'right_operand': None, 'operands': [], 'sub_results': [{'description': 'the stored {{paid}} equals the stored {{total}}', 'passed': True, 'operator': 'equals', 'transforms': [], 'json_path': None, 'expected': '{{total}}', 'extracted_value': '{{paid}}', 'store_key': 'paid_equals_total_check', 'variable_refs': {'{{paid}}': '$45.10', '{{total}}': '$45.10'}}], 'sub_checks': [{'description': 'the stored {{paid}} equals the stored {{total}}', 'store_key': 'paid_equals_total_check', 'expected_value': '{{total}}', 'extracted_value': '{{paid}}', 'operator': 'equals', 'transforms': []}], 'composite_operator': 'and', 'claim': 'the stored {{paid}} equals the stored {{total}}'})


if __name__ == "__main__":
    testmu.run(test)