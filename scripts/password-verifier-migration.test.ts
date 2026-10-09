import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { handleToken } from '../src/handlers/identity';
import { AuthService } from '../src/services/auth';
import { RateLimitService } from '../src/services/ratelimit';
import { StorageService } from '../src/services/storage';
import { upgradePasswordVerifier } from '../src/services/storage-user-repo';
import type { Env, User } from '../src/types';

test('verifier migration preserves vault keys, timestamps and sessions', async (ctx) => {
  const sqlite = new DatabaseSync(':memory:');
  ctx.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE users(id TEXT, master_password_hash TEXT, security_stamp TEXT, status TEXT, key TEXT, updated_at TEXT);
    INSERT INTO users VALUES ('owner','old','stamp','active','encrypted-vault-key','original-date');
    CREATE TABLE refresh_tokens(token TEXT, user_id TEXT);
    INSERT INTO refresh_tokens VALUES ('synthetic-session','owner');`);
  const db = {
    prepare(sql: string) {
      return { bind(...values: string[]) {
        return { async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; } };
      } };
    },
  } as unknown as D1Database;
  assert.equal(await upgradePasswordVerifier(db, 'owner', 'old', 'stamp', 'new'), true);
  assert.deepEqual({ ...sqlite.prepare('SELECT * FROM users').get() }, {
    id: 'owner', master_password_hash: 'new', security_stamp: 'stamp', status: 'active', key: 'encrypted-vault-key', updated_at: 'original-date',
  });
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM refresh_tokens').get()?.count, 1);
  assert.equal(await upgradePasswordVerifier(db, 'owner', 'old', 'stamp', 'overwrite'), false);
  assert.equal(await upgradePasswordVerifier(db, 'owner', 'new', 'different-stamp', 'overwrite'), false);
  sqlite.exec("UPDATE users SET status='banned'");
  assert.equal(await upgradePasswordVerifier(db, 'owner', 'new', 'stamp', 'overwrite'), false);
  sqlite.exec('DELETE FROM users');
  assert.equal(await upgradePasswordVerifier(db, 'owner', 'new', 'stamp', 'overwrite'), false);
});

function loginFixture(ctx: TestContext, totpSecret: string | null = null) {
  const user = {
    id: 'synthetic-owner', email: 'synthetic@example.test', masterPasswordHash: 'synthetic-client-hash',
    status: 'active', securityStamp: 'synthetic-stamp', key: 'encrypted-vault-key', privateKey: 'encrypted-private-key',
    kdfType: 0, kdfIterations: 600000, role: 'user', totpSecret,
  } as User;
  const migrations: string[] = [];
  const events: string[] = [];
  ctx.mock.method(StorageService.prototype, 'getUser', async () => user);
  ctx.mock.method(StorageService.prototype, 'getAccountPasskeyCredentialsByUserId', async () => []);
  ctx.mock.method(StorageService.prototype, 'createAuditLog', async () => {});
  ctx.mock.method(StorageService.prototype, 'getConfigValue', async () => null);
  ctx.mock.method(StorageService.prototype, 'pruneAuditLogs', async () => {});
  ctx.mock.method(StorageService.prototype, 'upgradePasswordVerifier', async (_id: string, _old: string, _stamp: string, next: string) => {
    migrations.push(next); events.push('migration'); return true;
  });
  ctx.mock.method(RateLimitService.prototype, 'checkLoginAttempt', async () => ({ allowed: true }));
  ctx.mock.method(RateLimitService.prototype, 'recordFailedLogin', async () => ({ locked: false }));
  ctx.mock.method(RateLimitService.prototype, 'clearLoginAttempts', async () => {});
  ctx.mock.method(AuthService.prototype, 'generateAccessToken', async () => { events.push('access-token'); return 'synthetic-access-token'; });
  ctx.mock.method(AuthService.prototype, 'generateRefreshToken', async () => 'synthetic-refresh-token');
  const env = { DB: {}, JWT_SECRET: 'synthetic-test-secret-32-characters-long' } as Env;
  const login = (extra: Record<string, string> = {}) => handleToken(new Request('https://vault.example.test/identity/connect/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ grant_type: 'password', username: user.email, password: 'synthetic-client-hash', ...extra }),
  }), env);
  return { user, migrations, events, login };
}

test('password login upgrades before issuing tokens and leaves vault keys intact', async (ctx) => {
  const f = loginFixture(ctx);
  assert.equal((await f.login()).status, 200);
  assert.equal(f.migrations.length, 1);
  assert.match(f.user.masterPasswordHash, /^\$s2\$100000\$/);
  assert.deepEqual(f.events, ['migration', 'access-token']);
  assert.equal(f.user.key, 'encrypted-vault-key');
  assert.equal(f.user.securityStamp, 'synthetic-stamp');
});

test('missing and invalid second factors do not migrate an existing account', async (ctx) => {
  const f = loginFixture(ctx, 'JBSWY3DPEHPK3PXP');
  assert.equal((await f.login()).status, 400);
  assert.equal((await f.login({ twoFactorProvider: '0', twoFactorToken: 'invalid' })).status, 400);
  assert.deepEqual(f.migrations, []);
  assert.equal(f.user.masterPasswordHash, 'synthetic-client-hash');
});

test('failed password and disabled-account logins do not migrate verifiers', async (ctx) => {
  const f = loginFixture(ctx);
  assert.equal((await f.login({ password: 'incorrect' })).status, 400);
  f.user.status = 'banned';
  assert.equal((await f.login()).status, 400);
  assert.deepEqual(f.migrations, []);
});

test('approved auth-request access codes never replace a password verifier', async (ctx) => {
  const f = loginFixture(ctx);
  ctx.mock.method(StorageService.prototype, 'getAuthRequestByIdForUser', async () => ({
    id: 'synthetic-request', userId: f.user.id, type: 0, approved: true,
    accessCode: 'synthetic-access-code', key: 'encrypted-request-key',
    creationDate: new Date().toISOString(), responseDate: new Date().toISOString(), authenticationDate: null,
  }));
  ctx.mock.method(StorageService.prototype, 'markAuthRequestAuthenticated', async () => {});
  assert.equal((await f.login({ authRequest: 'synthetic-request', password: 'synthetic-access-code' })).status, 200);
  assert.deepEqual(f.migrations, []);
  assert.equal(f.user.masterPasswordHash, 'synthetic-client-hash');
});

test('opportunistic migration failure does not deny an otherwise valid login', async (ctx) => {
  const f = loginFixture(ctx);
  ctx.mock.method(StorageService.prototype, 'upgradePasswordVerifier', async () => { throw new Error('synthetic database failure'); });
  assert.equal((await f.login()).status, 200);
  assert.equal(f.user.masterPasswordHash, 'synthetic-client-hash');
});
