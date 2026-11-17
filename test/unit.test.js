import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseDiff } from '../src/classify.js';
import { addTag, hasTag, formFields, assertNotProse, testBody } from '../src/write-check.js';

const cfg = {
  lint: { files: ['demo-app/public'] },
  handlers: [{ file: 'demo-app/src/signup.js', export: 'createAccount', form: 'demo-app/public/index.html' }],
};
const flow = { name: 'signup', test: '.testmuai/tests/signup_test.md' };

const diff = (file, removed, added) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-${removed}\n+${added}\n`;

test('fake-disabled fix -> eslint rule', () => {
  const d = classify({
    failure: { reason: 'Create account looked disabled but the click still went through' },
    fixDiff: diff('demo-app/public/app.js', "  submit.classList.toggle('is-disabled', !terms.checked);", '  submit.disabled = !terms.checked;'),
    cfg,
    flow,
  });
  assert.equal(d.type, 'eslint');
  assert.match(d.pattern.selector, /classList/);
});

test('handler fix -> unit test', () => {
  const d = classify({
    failure: { reason: 'Welcome says Free plan instead of the Pro plan' },
    fixDiff: diff('demo-app/src/signup.js', 'const plan = payload.planId;', 'const plan = payload.plan;'),
    cfg,
    flow,
  });
  assert.equal(d.type, 'unit-test');
  assert.equal(d.handler.export, 'createAccount');
});

test('anything else -> smoke, never nothing', () => {
  const d = classify({ failure: { reason: 'heading color is wrong' }, fixDiff: diff('demo-app/public/style.css', 'a', 'b'), cfg, flow });
  assert.equal(d.type, 'smoke');
  assert.ok(d.reason.length > 0);
});

test('empty-value text is noted but never returns prose', () => {
  const d = classify({ failure: { reason: 'email was sent empty' }, fixDiff: diff('demo-app/public/style.css', 'a', 'b'), cfg, flow });
  assert.equal(d.type, 'smoke');
  assert.ok(d.considered.some((c) => c.startsWith('type:')));
});

test('parseDiff splits files and lines', () => {
  const files = parseDiff(diff('a.js', 'old', 'new') + diff('b.js', 'x', 'y'));
  assert.deepEqual(files.map((f) => [f.file, f.removed, f.added]), [['a.js', ['old'], ['new']], ['b.js', ['x'], ['y']]]);
});

test('addTag handles inline, block and missing tags', () => {
  assert.ok(hasTag(addTag('---\nmode: testing\ntags: [signup]\n---\n## a\n', 'smoke'), 'smoke'));
  assert.ok(hasTag(addTag('---\nmode: testing\ntags:\n  - signup\n---\n## a\n', 'smoke'), 'smoke'));
  assert.ok(hasTag(addTag('---\nmode: testing\n---\n## a\n', 'smoke'), 'smoke'));
  assert.ok(hasTag(addTag('## a\n', 'smoke'), 'smoke'));
  const twice = addTag(addTag('---\ntags: [a]\n---\n', 'smoke'), 'smoke');
  assert.equal(twice.match(/smoke/g).length, 1);
});

test('tags live in frontmatter, so promotion does not change the locked test body', () => {
  const md = '---\nmode: testing\ntags: [signup]\n---\n## step\n';
  assert.equal(testBody(addTag(md, 'smoke')), testBody(md));
});

test('formFields skips checkboxes and picks the last select option', () => {
  const html = '<input name="name" type="text"><input name="email" type="email"><input name="terms" type="checkbox"><select name="plan"><option value="free">F</option><option value="pro">P</option></select>';
  assert.deepEqual(formFields(html).map((f) => [f.name, f.value]), [['name', 'Ratchet Probe name'], ['email', 'probe@ratchet.test'], ['plan', 'pro']]);
});

test('never writes AGENTS.md or CLAUDE.md', () => {
  assert.throws(() => assertNotProse('/x/AGENTS.md'));
  assert.throws(() => assertNotProse('/x/claude.md'));
  assert.doesNotThrow(() => assertNotProse('/x/tests/ratchet/a.test.js'));
});
