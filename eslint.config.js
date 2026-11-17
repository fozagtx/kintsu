// Ratchet writes rules between the markers below. Each one came from a bug
// Kane caught in a real browser; the message names its receipt in .ratchet/.
// Locked rules only tighten: ratchet verify blocks if one is removed.

// ratchet:rules:begin
const ratchetRules = [
  {
    "selector": "CallExpression[callee.object.property.name='classList'][callee.property.name=/^(add|toggle)$/] > Literal[value=/disabled/]",
    "message": "[bug-20261117-155802-signup-terms] Do not fake a disabled control by toggling a 'disabled' CSS class: it still fires. Set element.disabled instead. Evidence: .ratchet/evidence/bug-20261117-155802-signup-terms.evidence"
  }
];
// ratchet:rules:end

export default [
  {
    files: ['demo-app/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: ratchetRules.length ? { 'no-restricted-syntax': ['error', ...ratchetRules] } : {},
  },
];
