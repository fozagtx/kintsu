// Ratchet writes rules between the markers below. Each one came from a bug
// Kane caught in a real browser; the message names its receipt in .ratchet/.
// Locked rules only tighten: ratchet verify blocks if one is removed.

// ratchet:rules:begin
const ratchetRules = [];
// ratchet:rules:end

export default [
  {
    files: ['demo-app/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: ratchetRules.length ? { 'no-restricted-syntax': ['error', ...ratchetRules] } : {},
  },
];
