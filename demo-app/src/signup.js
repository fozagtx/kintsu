// Signup handler. The server calls createAccount(payload, store) for every
// POST /api/signup. The store contract is: store.insert(record) -> saved record.

const PLANS = new Set(['free', 'team', 'pro']);

export class ValidationError extends Error {}

export function createAccount(payload, store) {
  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const plan = PLANS.has(payload.plan) ? payload.plan : 'free';

  if (!name) throw new ValidationError('Name is required');
  if (!email.includes('@')) throw new ValidationError('Enter a valid email');

  return store.insert({ name, email, plan, createdAt: new Date().toISOString() });
}
