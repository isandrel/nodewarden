import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';
import { createJWT } from '../src/utils/jwt';

const userId = '92ccde0c-9225-4ca8-a093-fb3ac66c136a';
const secret = 'local-runtime-test-secret-not-a-production-credential';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'https://vault.example.test';

test('notification and cipher contracts in the local Worker runtime', { timeout: 60_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'nodewarden-notifications-test-'));
  const bundle = join(directory, 'worker.mjs');
  // Storage inspection is exported only by this isolated test bundle. The real
  // entrypoint and production Durable Object have no such inspection methods.
  await build({
    stdin: {
      contents: `
        export { default, BackupTransferRunner } from './src/index';
        import { NotificationsHub as ProductionHub } from './src/durable/notifications-hub';
        export class NotificationsHub extends ProductionHub {
          async ticketCountForTest() {
            return (await this.ctx.storage.list({prefix: 'ws-token:'})).size;
          }
          async expireTicketsForTest() {
            for (const [key, value] of await this.ctx.storage.list({prefix: 'ws-token:'})) {
              await this.ctx.storage.put(key, {...value, expiresAt: Date.now() - 1});
            }
          }
          async alarmForTest() { await this.alarm(); }
        }
      `,
      resolveDir: root,
      loader: 'ts',
    },
    outfile: bundle,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['cloudflare:workers'],
    logLevel: 'silent',
  });
  const mf = new Miniflare({
    modules: true,
    modulesRoot: directory,
    scriptPath: bundle,
    compatibilityDate: '2024-01-01',
    bindings: { JWT_SECRET: secret, ALLOW_LEGACY_NOTIFICATION_QUERY_TOKEN: '1' },
    d1Databases: ['DB'],
    durableObjects: {
      NOTIFICATIONS_HUB: { className: 'NotificationsHub', useSQLite: true },
      BACKUP_TRANSFER_RUNNER: { className: 'BackupTransferRunner', useSQLite: true },
    },
    outboundService: () => new Response('External network disabled in this test', { status: 503 }),
    log: new Log(LogLevel.ERROR),
  });
  const sockets = new Set<{ close(): void }>();
  t.after(async () => {
    for (const socket of sockets) socket.close();
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
  });

  assert.equal((await mf.dispatchFetch(`${base}/config`)).status, 200);
  const db = await mf.getD1Database('DB');
  await db.prepare(`INSERT INTO users
    (id,email,master_password_hash,key,kdf_type,kdf_iterations,security_stamp,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(userId, 'runtime@example.test', 'test-proof', 'test-key', 0, 600000,
    'test-stamp', new Date().toISOString(), new Date().toISOString()).run();
  const token = await createJWT({ sub: userId, email: 'runtime@example.test', name: 'Runtime Test', sstamp: 'test-stamp' }, secret);
  const bearer = { Authorization: `Bearer ${token}` };
  const ns = await mf.getDurableObjectNamespace('NOTIFICATIONS_HUB');
  const hub = ns.get(ns.idFromName(userId));

  async function negotiate() {
    const response = await mf.dispatchFetch(`${base}/notifications/hub/negotiate?negotiateVersion=1`, {
      method: 'POST', headers: bearer,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return (await response.json() as { connectionToken: string }).connectionToken;
  }
  function upgrade(query: string, headers: Record<string, string> = {}) {
    return mf.dispatchFetch(`${base}/notifications/hub?${query}`, { headers: { Upgrade: 'websocket', ...headers } });
  }
  function keepSocket(response: Awaited<ReturnType<typeof upgrade>>) {
    assert.equal(response.status, 101);
    assert.ok(response.webSocket);
    response.webSocket.accept();
    sockets.add(response.webSocket);
    return response.webSocket;
  }
  function message(socket: ReturnType<typeof keepSocket>) {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket message timed out')), 5000);
      socket.addEventListener('message', (event) => {
        clearTimeout(timer);
        resolve(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
      }, { once: true });
    });
  }

  await t.test('query-token client completes MessagePack handshake and reconnects', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const socket = keepSocket(await upgrade(`access_token=${encodeURIComponent(token)}`));
      const ack = message(socket);
      socket.send('{"protocol":"messagepack","version":1}\u001e');
      assert.equal(await ack, '{}\u001e');
      socket.close();
      sockets.delete(socket);
    }
  });

  await t.test('one ticket admits only one of two concurrent real upgrades', async () => {
    const ticket = await negotiate();
    const query = `id=${encodeURIComponent(ticket)}`;
    const responses = await Promise.all([upgrade(query), upgrade(query)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [101, 401]);
    keepSocket(responses.find((r) => r.status === 101)!);
    assert.equal((await upgrade(query)).status, 401);
  });

  await t.test('expired stored tickets are rejected and the real alarm clears unused tickets', async () => {
    const ticket = await negotiate();
    await hub.expireTicketsForTest();
    assert.equal((await upgrade(`id=${encodeURIComponent(ticket)}`)).status, 401);
    await negotiate();
    assert.ok(await hub.ticketCountForTest() > 0);
    await hub.expireTicketsForTest();
    await hub.alarmForTest();
    assert.equal(await hub.ticketCountForTest(), 0);
  });

  await t.test('query credentials cannot authenticate ordinary API routes or negotiation', async () => {
    assert.equal((await mf.dispatchFetch(`${base}/api/sync?access_token=${encodeURIComponent(token)}`)).status, 401);
    assert.equal((await mf.dispatchFetch(`${base}/notifications/hub/negotiate?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
    })).status, 401);
    assert.equal((await upgrade(`access_token=${encodeURIComponent(token)}&id=invalid`)).status, 401);
  });

  await t.test('cipher full updates persist clearing and emit a notification', async () => {
    const socket = keepSocket(await upgrade(`id=${encodeURIComponent(await negotiate())}`));
    const ack = message(socket);
    socket.send('{"protocol":"json","version":1}\u001e');
    assert.equal(await ack, '{}\u001e');
    const cipherId = '66f124ef-ccdd-41e6-b4e3-8edebc7c276e';
    // Synthetic encryption-shaped values; no private vault data is involved.
    const encrypted = '2.AAAAAAAAAAAAAAAAAAAAAA==|AAAAAAAAAAAAAAAAAAAAAA==|AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    await db.prepare(`INSERT INTO ciphers
      (id,user_id,type,name,notes,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
      .bind(cipherId, userId, 1, encrypted, encrypted, JSON.stringify({
        login: { username: encrypted, password: encrypted }, fields: [{ name: encrypted, value: encrypted, type: 0 }],
      }), new Date().toISOString(), new Date().toISOString()).run();
    const notification = message(socket);
    const response = await mf.dispatchFetch(`${base}/api/ciphers/${cipherId}`, {
      method: 'PUT', headers: { ...bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 1, name: encrypted, login: { username: encrypted, password: encrypted } }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json() as { notes: unknown; fields: unknown };
    assert.equal(body.notes, null);
    assert.equal(body.fields, null);
    const stored = await db.prepare('SELECT notes,data FROM ciphers WHERE id=?').bind(cipherId).first<{ notes: unknown; data: string }>();
    assert.equal(stored?.notes, null);
    assert.equal(JSON.parse(stored!.data).fields, null);
    assert.match(await notification, /ReceiveMessage/);
    const read = await mf.dispatchFetch(`${base}/api/ciphers/${cipherId}`, { headers: bearer });
    assert.equal(read.status, 200);
    assert.equal((await read.json() as { notes: unknown }).notes, null);
  });
});
