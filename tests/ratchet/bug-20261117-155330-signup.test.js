// Written by Ratchet for bug-20261117-155330-signup. Locked check: do not weaken or delete.
// Kane caught this in a real browser. Evidence: .ratchet/evidence/bug-20261117-155330-signup.evidence
// Receipt: .ratchet/bug-20261117-155330-signup.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccount } from '../../demo-app/src/signup.js';

test('bug-20261117-155330-signup: createAccount keeps every submitted signup field', async () => {
  const payload = {
    "name": "Ratchet Probe name",
    "email": "probe@ratchet.test",
    "plan": "pro"
  };
  const inserted = [];
  const store = { insert: (row) => { const saved = { id: inserted.length + 1, ...row }; inserted.push(saved); return saved; } };

  const account = await createAccount(payload, store);

  assert.equal(inserted.length, 1, 'handler must insert exactly one record');
  for (const [field, sent] of Object.entries(payload)) {
    assert.equal(inserted[0][field], sent, `field "${field}" was sent as ${JSON.stringify(sent)} but stored as ${JSON.stringify(inserted[0][field])}`);
    assert.equal(account[field], sent, `field "${field}" was sent as ${JSON.stringify(sent)} but returned as ${JSON.stringify(account[field])}`);
  }
});
