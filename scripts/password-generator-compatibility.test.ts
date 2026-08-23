import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultGeneratorSettings,
  generatePassword,
  normalizeGeneratorSettings,
} from '@/lib/password-generator';
import { generateSshKey } from '@/lib/ssh-key-generator';

const openSshPrivateKeyStart = ['-----BEGIN', 'OPENSSH PRIVATE KEY-----'].join(' ');
const openSshPrivateKeyEnd = ['-----END', 'OPENSSH PRIVATE KEY-----'].join(' ');

test('expanded password settings preserve all enabled minimums', () => {
  const value = generatePassword({
    ...defaultGeneratorSettings.password,
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    special: true,
    minUppercase: 2,
    minLowercase: 2,
    minNumbers: 2,
    minSpecial: 2,
  });

  assert.equal(value.length, 20);
  assert.ok((value.match(/[A-Z]/g) || []).length >= 2);
  assert.ok((value.match(/[a-z]/g) || []).length >= 2);
  assert.ok((value.match(/[0-9]/g) || []).length >= 2);
  assert.ok((value.match(/[^A-Za-z0-9]/g) || []).length >= 2);
});

test('generator settings clamp unsafe stored values', () => {
  const settings = normalizeGeneratorSettings({
    mode: 'sshKey',
    password: { length: -1 },
    pin: { length: 1_000 },
    sshKey: { type: 'rsa', rsaLength: 1_024, comment: 'line one\nline two' },
  });

  assert.equal(settings.password.length, 5);
  assert.equal(settings.pin.length, 64);
  assert.equal(settings.sshKey.type, 'rsa');
  assert.equal(settings.sshKey.rsaLength, 4_096);
  assert.equal(settings.sshKey.comment, 'line one line two');
});

test('browser SSH generation emits OpenSSH ED25519 material', async () => {
  const key = await generateSshKey({ type: 'ed25519', rsaLength: 2_048, comment: 'nodewarden\nlocal' });

  assert.equal(key.type, 'ED25519');
  assert.equal(key.bits, 256);
  assert.match(key.publicKey, /^ssh-ed25519 [A-Za-z0-9+/=]+ nodewarden local$/);
  assert.ok(key.privateKey.startsWith(openSshPrivateKeyStart));
  assert.ok(key.privateKey.endsWith(`${openSshPrivateKeyEnd}\n`));
  assert.match(key.fingerprint, /^SHA256:[A-Za-z0-9+/]+$/);
});

test('browser SSH generation emits OpenSSH RSA material', async () => {
  const key = await generateSshKey({ type: 'rsa', rsaLength: 2_048, comment: '' });

  assert.equal(key.type, 'RSA');
  assert.equal(key.bits, 2_048);
  assert.match(key.publicKey, /^ssh-rsa [A-Za-z0-9+/=]+$/);
  assert.ok(key.privateKey.startsWith(openSshPrivateKeyStart));
  assert.match(key.fingerprint, /^SHA256:[A-Za-z0-9+/]+$/);
});
