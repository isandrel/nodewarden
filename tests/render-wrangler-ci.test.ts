import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { renderWranglerConfig } from '../scripts/render-wrangler-ci.mjs';

const values = {
  accountId: 'account-id',
  databaseId: 'database-id',
  r2Bucket: 'existing-attachments-bucket',
};

test('CI config rendering injects identifiers without dropping durable resources', async () => {
  const source = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const rendered = renderWranglerConfig(source, values);

  assert.match(rendered, /account_id = "account-id"/);
  assert.match(rendered, /database_id = "database-id"/);
  assert.match(rendered, /bucket_name = "existing-attachments-bucket"/);
  assert.match(rendered, /name = "NOTIFICATIONS_HUB"/);
  assert.match(rendered, /name = "BACKUP_TRANSFER_RUNNER"/);
  assert.match(rendered, /tag = "v1-notifications-hub"/);
  assert.match(rendered, /tag = "v2-backup-transfer-runner"/);
  assert.match(rendered, /crons = \[ "\*\/5 \* \* \* \*" \]/);
});

test('CI config rendering fails when a required marker is missing', async () => {
  const source = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.throws(
    () => renderWranglerConfig(source.replace('name = "BACKUP_TRANSFER_RUNNER"', ''), values),
    /required config marker/
  );
});

test('CI config rendering fails when a target occurs more than once', async () => {
  const source = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.throws(
    () => renderWranglerConfig(`${source}\ncompatibility_date = "2024-01-01"\n`, values),
    /exactly one compatibility_date/
  );
});

test('CI config rendering rejects missing or unsafe secret values', async () => {
  const source = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.throws(() => renderWranglerConfig(source, { ...values, accountId: '' }), /is required/);
  assert.throws(() => renderWranglerConfig(source, { ...values, r2Bucket: 'bucket"\naccount_id="bad' }), /unsupported characters/);
});
