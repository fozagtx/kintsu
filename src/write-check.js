// Writes one deterministic check for a classified bug. Returns
// { check, undo } so a check that fails its own proof can be taken back.
//
// Hard rule: Ratchet never writes AGENTS.md or CLAUDE.md. Prose is not a check.

import fs from 'node:fs';
import path from 'node:path';
import { sha256, writeText, rel } from './store.js';

const PROSE_FILES = new Set(['agents.md', 'claude.md']);

export function assertNotProse(file) {
  if (PROSE_FILES.has(path.basename(file).toLowerCase())) {
    throw new Error(`Refusing to write ${file}: Ratchet never writes prose rules. Ask the human.`);
  }
}

export function writeCheck(root, cfg, bugId, decision, flow, evidence) {
  if (decision.type === 'unit-test') return writeUnitTest(root, bugId, decision, evidence);
  if (decision.type === 'eslint') return writeEslintRule(root, bugId, decision, evidence);
  return promoteToSmoke(root, flow);
}

// ---------------------------------------------------------------- unit test

export function formFields(html) {
  const attrs = (tag) =>
    Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1].toLowerCase(), m[2]]));
  const fields = [];
  for (const [tag] of html.matchAll(/<input\b[^>]*>/gi)) {
    const a = attrs(tag);
    const type = (a.type ?? 'text').toLowerCase();
    if (!a.name || ['checkbox', 'radio', 'submit', 'button', 'hidden', 'file'].includes(type)) continue;
    fields.push({ name: a.name, value: type === 'email' ? 'probe@ratchet.test' : `Ratchet Probe ${a.name}` });
  }
  for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const a = attrs(`<x ${m[1]}>`);
    const options = [...m[2].matchAll(/<option\b[^>]*value="([^"]*)"/gi)].map((o) => o[1]);
    // The last option is the one least likely to equal a silent default.
    if (a.name && options.length) fields.push({ name: a.name, value: options.at(-1) });
  }
  return fields;
}

function writeUnitTest(root, bugId, decision, evidence) {
  const { handler } = decision;
  const html = fs.readFileSync(path.join(root, handler.form), 'utf8');
  const fields = handler.fields
    ? formFields(html).filter((f) => handler.fields.includes(f.name))
    : formFields(html);
  if (!fields.length) throw new Error(`No form fields found in ${handler.form}`);

  const file = path.join(root, 'tests', 'ratchet', `${bugId}.test.js`);
  assertNotProse(file);
  let importPath = path.relative(path.dirname(file), path.join(root, handler.file)).split(path.sep).join('/');
  if (!importPath.startsWith('.')) importPath = `./${importPath}`;
  const payload = Object.fromEntries(fields.map((f) => [f.name, f.value]));

  const source = `// Written by Ratchet for ${bugId}. Locked check: do not weaken or delete.
// Kane caught this in a real browser. Evidence: ${evidence ?? 'none sealed'}
// Receipt: .ratchet/${bugId}.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ${handler.export} } from '${importPath}';

test('${bugId}: ${handler.export} keeps every submitted signup field', async () => {
  const payload = ${JSON.stringify(payload, null, 2).replace(/\n/g, '\n  ')};
  const inserted = [];
  const store = { insert: (row) => { const saved = { id: inserted.length + 1, ...row }; inserted.push(saved); return saved; } };

  const account = await ${handler.export}(payload, store);

  assert.equal(inserted.length, 1, 'handler must insert exactly one record');
  for (const [field, sent] of Object.entries(payload)) {
    assert.equal(inserted[0][field], sent, \`field "\${field}" was sent as \${JSON.stringify(sent)} but stored as \${JSON.stringify(inserted[0][field])}\`);
    assert.equal(account[field], sent, \`field "\${field}" was sent as \${JSON.stringify(sent)} but returned as \${JSON.stringify(account[field])}\`);
  }
});
`;
  writeText(file, source);
  return {
    check: { type: 'unit-test', path: rel(root, file), sha256: sha256(source), fields: fields.map((f) => f.name) },
    undo: () => fs.rmSync(file, { force: true }),
  };
}

// --------------------------------------------------------------- eslint rule

const BEGIN = '// ratchet:rules:begin';
const END = '// ratchet:rules:end';

export function readEslintRules(text) {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < start) return null;
  const block = text.slice(start + BEGIN.length, end);
  const m = /const ratchetRules = ([\s\S]*?);\s*$/.exec(block.trim());
  return m ? { rules: JSON.parse(m[1]), start, end } : null;
}

function writeEslintRule(root, bugId, decision, evidence) {
  const file = path.join(root, 'eslint.config.js');
  assertNotProse(file);
  const before = fs.readFileSync(file, 'utf8');
  const parsed = readEslintRules(before);
  if (!parsed) throw new Error(`eslint.config.js has no "${BEGIN}" / "${END}" block for Ratchet to write into`);

  const { selector, what } = decision.pattern;
  const message = `[${bugId}] Do not fake a disabled control by ${what}: it still fires. Set element.disabled instead. Evidence: ${evidence ?? 'none'}`;
  const rules = parsed.rules.filter((r) => r.selector !== selector).concat({ selector, message });
  const after =
    before.slice(0, parsed.start) +
    `${BEGIN}\nconst ratchetRules = ${JSON.stringify(rules, null, 2)};\n` +
    before.slice(parsed.end);
  fs.writeFileSync(file, after);
  return {
    check: { type: 'eslint', path: 'eslint.config.js', selector, pattern: decision.pattern.id },
    undo: () => fs.writeFileSync(file, before),
  };
}

// ----------------------------------------------------------- smoke promotion

export function promoteToSmoke(root, flow) {
  const file = path.join(root, flow.test);
  assertNotProse(file);
  if (!fs.existsSync(file)) throw new Error(`Saved Kane flow ${flow.test} does not exist; author it first`);
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, addTag(before, 'smoke'));
  return {
    check: { type: 'smoke', path: flow.test, tag: 'smoke', flow: flow.name },
    undo: () => fs.writeFileSync(file, before),
  };
}

export function addTag(md, tag) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(md);
  if (!fm) return `---\ntags: [${tag}]\n---\n${md}`;
  let body = fm[1];
  const inline = /^tags:\s*\[(.*)\]\s*$/m.exec(body);
  const block = /^tags:\s*\n((?:\s+-\s+.*\n?)*)/m.exec(body);
  if (inline) {
    const tags = inline[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    if (!tags.includes(tag)) tags.push(tag);
    body = body.replace(inline[0], `tags: [${tags.join(', ')}]`);
  } else if (block) {
    if (!new RegExp(`^\\s+-\\s+['"]?${tag}['"]?\\s*$`, 'm').test(block[1])) {
      body = body.replace(block[0], `${block[0].replace(/\n?$/, '\n')}  - ${tag}\n`).replace(/\n$/, '');
    }
  } else {
    body += `\ntags: [${tag}]`;
  }
  return md.replace(fm[0], `---\n${body}\n---\n`);
}

export function hasTag(md, tag) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!fm) return false;
  return new RegExp(`^tags:.*\\b${tag}\\b|^\\s+-\\s+['"]?${tag}['"]?\\s*$`, 'm').test(fm[1]);
}

// Body of a saved test without its frontmatter: what the flow lock hashes.
export function testBody(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '');
}
