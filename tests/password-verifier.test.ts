import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService } from '../src/services/auth';
import { createPasswordVerifier, needsPasswordVerifierUpgrade, verifyPasswordVerifier } from '../src/services/password-verifier';
import type { Env } from '../src/types';

const clientHash = 'synthetic-client-password-hash';
const email = 'synthetic@example.test';

async function legacyVerifier(): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(clientHash), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 100_000, salt: new TextEncoder().encode(email) }, key, 256);
  return '$s$' + btoa(String.fromCharCode(...new Uint8Array(bits)));
}

test('salted verifiers differ while accepting only the correct client hash', async () => {
  const first = await createPasswordVerifier(clientHash);
  const second = await createPasswordVerifier(clientHash);
  assert.notEqual(first, second);
  assert.match(first, /^\$s2\$100000\$/);
  assert.equal(await verifyPasswordVerifier(clientHash, first, email), true);
  assert.equal(await verifyPasswordVerifier('wrong', first, email), false);
  assert.equal(needsPasswordVerifierUpgrade(first), false);
});

test('legacy email-salted and raw verifiers remain usable and eligible for upgrade', async () => {
  const legacy = await legacyVerifier();
  assert.equal(await verifyPasswordVerifier(clientHash, legacy, email.toUpperCase()), true);
  assert.equal(await verifyPasswordVerifier(clientHash, legacy, 'other@example.test'), false);
  assert.equal(await verifyPasswordVerifier(clientHash, clientHash, email), true);
  assert.equal(needsPasswordVerifierUpgrade(legacy), true);
  assert.equal(needsPasswordVerifierUpgrade(clientHash), true);
});

test('missing, malformed, unknown and unsupported-work-factor verifiers fail closed', async () => {
  const valid = await createPasswordVerifier(clientHash);
  for (const stored of [null, '', '$s$bad', '$s2$bad', '$future$value', valid.replace('$100000$', '$999999999$')]) {
    assert.equal(await verifyPasswordVerifier(stored ?? clientHash, stored, email), false);
  }
});

test('AuthService reads migrated verifiers without changing stored account data', async () => {
  const env = { DB: { prepare() { throw new Error('Verification must not write account data'); } } } as unknown as Env;
  const auth = new AuthService(env);
  assert.equal(await auth.verifyPassword(clientHash, await createPasswordVerifier(clientHash), email), true);
  assert.equal(await auth.verifyPassword(clientHash, await legacyVerifier(), email), true);
});
