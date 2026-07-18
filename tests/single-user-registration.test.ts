import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRegister } from '../src/handlers/accounts';
import { AuthService } from '../src/services/auth';
import type { Env } from '../src/types';

interface FakeUser {
  id: string;
  email: string;
}

class FakeD1Statement {
  private values: unknown[] = [];

  constructor(
    private readonly database: FakeD1Database,
    private readonly query: string
  ) {}

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.query.includes('SELECT COUNT(*) AS count FROM users')) {
      return { count: this.database.users.length } as T;
    }
    throw new Error(`Unexpected first() query: ${this.query}`);
  }

  async run(): Promise<{ meta: { changes: number } }> {
    this.database.executedStatements.push(this.query);

    if (this.query.startsWith('INSERT INTO users(') && this.query.includes('WHERE NOT EXISTS')) {
      if (this.database.users.length > 0) return { meta: { changes: 0 } };
      this.database.users.push({ id: String(this.values[0]), email: String(this.values[1]) });
      return { meta: { changes: 1 } };
    }
    if (this.query.startsWith('INSERT INTO config(')) {
      return { meta: { changes: 1 } };
    }
    if (this.query.startsWith('INSERT INTO audit_logs(')) {
      return { meta: { changes: 1 } };
    }

    throw new Error(`Unexpected run() query: ${this.query}`);
  }
}

class FakeD1Database {
  readonly users: FakeUser[];
  readonly invites = new Map([['valid-invite', { status: 'active', usedBy: null as string | null }]]);
  readonly executedStatements: string[] = [];

  constructor(userCount: number) {
    this.users = Array.from({ length: userCount }, (_, index) => ({
      id: `existing-${index}`,
      email: `existing-${index}@example.com`,
    }));
  }

  prepare(query: string): FakeD1Statement {
    return new FakeD1Statement(this, query);
  }
}

function createEnv(database: FakeD1Database): Env {
  return {
    DB: database as unknown as D1Database,
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters',
  } as Env;
}

function registrationRequest(inviteCode?: string): Request {
  return new Request('https://vault.example/api/accounts/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
    body: JSON.stringify({
      email: 'new-user@example.com',
      name: 'New User',
      masterPasswordHash: 'client-master-password-hash',
      key: '2.iv|ciphertext|mac',
      kdf: 0,
      kdfIterations: 600_000,
      inviteCode,
      keys: {
        publicKey: 'public-key',
        encryptedPrivateKey: '2.iv|ciphertext|mac',
      },
    }),
  });
}

test('an empty database can create the first administrator', async () => {
  const database = new FakeD1Database(0);
  const response = await handleRegister(registrationRequest(), createEnv(database));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, role: 'admin' });
  assert.equal(database.users.length, 1);
  assert.ok(database.executedStatements.some((query) => query.startsWith('INSERT INTO audit_logs(')));
});

for (const [label, inviteCode] of [
  ['without an invite', undefined],
  ['with an invalid invite', 'invalid-invite'],
  ['with a valid-looking invite', 'valid-invite'],
] as const) {
  test(`an existing user blocks registration ${label}`, async () => {
    const database = new FakeD1Database(1);
    const inviteBefore = structuredClone(database.invites.get('valid-invite'));
    const response = await handleRegister(registrationRequest(inviteCode), createEnv(database));

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Registration is disabled/);
    assert.equal(database.users.length, 1);
    assert.deepEqual(database.invites.get('valid-invite'), inviteBefore);
    assert.equal(database.executedStatements.length, 0, 'the invite and user records must remain unchanged');
  });
}

test('existing password verification remains valid', async () => {
  const env = createEnv(new FakeD1Database(1));
  const auth = new AuthService(env);
  const clientHash = 'existing-client-master-password-hash';
  const storedHash = await auth.hashPasswordServer(clientHash, 'existing@example.com');

  assert.equal(await auth.verifyPassword(clientHash, storedHash, 'existing@example.com'), true);
  assert.equal(await auth.verifyPassword('wrong-hash', storedHash, 'existing@example.com'), false);
});
