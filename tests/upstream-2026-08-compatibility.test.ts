import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildConfigResponse } from '../src/config-response';
import { buildAccountKeys } from '../src/utils/user-decryption';

test('config exposes the Bitwarden 2026.7 compatibility fields', () => {
  const config = buildConfigResponse('https://vault.example.test');

  assert.equal(config.version, '2026.6.0');
  assert.equal(config.settings.suppressOnboardingInterstitials, false);
  assert.equal(config.settings.disableUserRegistration, false);
});

test('account keys retain legacy aliases alongside current fields', () => {
  const keys = buildAccountKeys({ privateKey: 'wrapped-private-key', publicKey: 'public-key' }) as {
    object: string;
    Object: string;
    securityState: null;
    signatureKeyPair: null;
    publicKeyEncryptionKeyPair: { object: string; Object: string };
  };

  assert.equal(keys.object, 'privateKeys');
  assert.equal(keys.Object, 'privateKeys');
  assert.equal(keys.securityState, null);
  assert.equal(keys.signatureKeyPair, null);
  assert.equal(keys.publicKeyEncryptionKeyPair.object, 'publicKeyEncryptionKeyPair');
  assert.equal(keys.publicKeyEncryptionKeyPair.Object, 'publicKeyEncryptionKeyPair');
});

test('prelogin retains legacy KDF aliases alongside current fields', () => {
  const identity = readFileSync(new URL('../src/handlers/identity.ts', import.meta.url), 'utf8');
  const responseStart = identity.indexOf('function buildPreloginResponse');
  const responseEnd = identity.indexOf('\nfunction ', responseStart + 1);
  const preloginBuilder = identity.slice(responseStart, responseEnd < 0 ? undefined : responseEnd);

  assert.ok(responseStart >= 0, 'prelogin response builder must exist');
  assert.match(preloginBuilder, /kdfSettings:\s*\{/);
  assert.match(preloginBuilder, /kdfType,/);
  assert.match(preloginBuilder, /iterations: kdfIterations/);
  assert.match(preloginBuilder, /KdfSettings:\s*\{/);
  assert.match(preloginBuilder, /KdfType: kdfType/);
  assert.match(preloginBuilder, /Iterations: kdfIterations/);
  assert.match(preloginBuilder, /salt: null/);
});

test('backup attachment credentials are body-only and GET is rejected', () => {
  const router = readFileSync(new URL('../src/router-admin-backup.ts', import.meta.url), 'utf8');
  const handlers = readFileSync(new URL('../src/handlers/backup.ts', import.meta.url), 'utf8');
  const handlerStart = handlers.indexOf('export async function handleDownloadAdminBackupAttachment');
  const handlerEnd = handlers.indexOf('\nexport ', handlerStart + 1);
  const attachmentHandler = handlers.slice(handlerStart, handlerEnd < 0 ? undefined : handlerEnd);

  assert.ok(handlerStart >= 0, 'backup attachment handler must exist');
  assert.match(router, /if \(method === 'POST'\)/);
  assert.match(router, /if \(method === 'GET'\)/);
  assert.match(router, /POST with a JSON body/);
  assert.doesNotMatch(router, /method === 'GET' \|\| method === 'POST'/);
  assert.match(attachmentHandler, /request\.json/);
  assert.doesNotMatch(attachmentHandler, /searchParams/);
});
