// Maps one Kane failure (plus the diff that fixed it) to exactly one check.
//
//   click did nothing / fake-disabled control  -> ESLint rule   (eslint.config.js)
//   value sent empty or wrong type             -> narrower type (not built yet: falls through)
//   server accepted the request, dropped field -> unit test     (tests/ratchet/)
//   anything else                              -> smoke promotion of the saved Kane flow
//
// It never returns nothing and never returns prose.

const TEXT = {
  click: /\bdisabled\b|did nothing|no effect|not respond|unresponsive|detached|not clickable|still (?:submit|fire|creat|went through)|should not (?:be )?(?:submit|creat|allow)|was not blocked/i,
  empty: /\bempty\b|\bblank\b|\bundefined\b|\bnull\b|\bNaN\b|wrong type|as a string/i,
  dropped: /dropped|missing|not saved|ignored|instead of|expected\b.*\b(?:but|got|found|showed)|defaulted|does not (?:say|show|mention|contain)|did not (?:say|show)/i,
};

// Patterns that make a control look disabled while it still fires. Each one
// carries the ESLint selector that bans it, so the rule is derived from the
// exact line the fix removed.
export const FAKE_DISABLED = [
  {
    id: 'classlist-disabled',
    line: /classList\.(?:add|toggle)\(\s*['"][^'"]*disabled/i,
    selector:
      "CallExpression[callee.object.property.name='classList'][callee.property.name=/^(add|toggle)$/] > Literal[value=/disabled/]",
    what: "toggling a 'disabled' CSS class",
  },
  {
    id: 'aria-disabled-only',
    line: /setAttribute\(\s*['"]aria-disabled['"]/,
    selector: "CallExpression[callee.property.name='setAttribute'] > Literal[value='aria-disabled']",
    what: 'setting aria-disabled',
  },
  {
    id: 'classname-disabled',
    line: /className\s*\+?=\s*['"`][^'"`]*disabled/i,
    selector: "AssignmentExpression[left.property.name='className'] > Literal[value=/disabled/]",
    what: "assigning a 'disabled' className",
  },
];

export function parseDiff(diff) {
  const files = [];
  let cur = null;
  for (const line of diff.split('\n')) {
    const head = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (head) {
      cur = { file: head[2], added: [], removed: [] };
      files.push(cur);
    } else if (!cur || line.startsWith('+++') || line.startsWith('---')) {
      continue;
    } else if (line.startsWith('+')) cur.added.push(line.slice(1));
    else if (line.startsWith('-')) cur.removed.push(line.slice(1));
  }
  return files;
}

const under = (file, dirs) => dirs.some((d) => file === d || file.startsWith(d.replace(/\/?$/, '/')));

export function classify({ failure, fixDiff, cfg, flow }) {
  const text = [failure?.reason, failure?.summary, failure?.remark, JSON.stringify(failure?.finalState ?? '')]
    .filter(Boolean)
    .join('\n');
  const files = parseDiff(fixDiff);
  const signals = Object.fromEntries(Object.entries(TEXT).map(([k, re]) => [k, re.test(text)]));
  const considered = [];

  // 1. A control that only looked disabled. Needs the removed line, not just the words.
  const lintDirs = cfg.lint?.files ?? [];
  for (const f of files.filter((f) => under(f.file, lintDirs))) {
    for (const removed of f.removed) {
      const pattern = FAKE_DISABLED.find((p) => p.line.test(removed));
      if (!pattern) continue;
      const fixedWithRealDisabled = f.added.some((a) => /\.disabled\s*=|\bdisabled\b(?!['"-])/.test(a));
      return {
        type: 'eslint',
        reason:
          `The fix removed ${pattern.what} in ${f.file} ("${removed.trim()}")` +
          (fixedWithRealDisabled ? ' and replaced it with the real disabled property.' : '.') +
          (signals.click ? ' Kane reported a control that should have been blocked.' : ''),
        target: 'eslint.config.js',
        pattern,
        file: f.file,
        signals,
      };
    }
  }
  considered.push('eslint: no fake-disabled pattern in the lines the fix removed');

  // 2. Empty / wrong-type value. Type checks are not built yet, so say so and move on.
  if (signals.empty) considered.push('type: Kane text suggests an empty or mistyped value, but the type check writer is not built; trying the next check');

  // 3. Server dropped a field: the fix touched a declared handler.
  for (const handler of cfg.handlers ?? []) {
    const touched = files.find((f) => f.file === handler.file);
    if (!touched) continue;
    return {
      type: 'unit-test',
      reason:
        `The fix changed the handler ${handler.file} (${handler.export}), which receives the submitted form.` +
        (signals.dropped ? ' Kane saw a submitted value that did not come back.' : '') +
        ' A unit test that round-trips every form field pins it with no browser.',
      target: `tests/ratchet/`,
      handler,
      signals,
    };
  }
  considered.push('unit-test: the fix did not touch any handler declared in .ratchet/config.json');

  // 4. Fallback, always available.
  return {
    type: 'smoke',
    reason: `No deterministic check fits this failure. Promoting the saved Kane flow "${flow.name}" into the smoke tag so every smoke run replays it with healing off.`,
    target: flow.test,
    considered,
    signals,
  };
}
