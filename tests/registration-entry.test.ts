import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowCreateAccount } from '../webapp/src/lib/registration-policy';

test('shows Create Account while the database has no users', () => {
  assert.equal(shouldShowCreateAccount(false), true);
});

test('hides Create Account after the first user exists', () => {
  assert.equal(shouldShowCreateAccount(true), false);
});

test('hides Create Account while bootstrap state is unknown', () => {
  assert.equal(shouldShowCreateAccount(undefined), false);
});
