import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const REQUIRED_CONFIG_MARKERS = [
  'name = "NOTIFICATIONS_HUB"',
  'class_name = "NotificationsHub"',
  'name = "BACKUP_TRANSFER_RUNNER"',
  'class_name = "BackupTransferRunner"',
  'tag = "v1-notifications-hub"',
  'new_sqlite_classes = [ "NotificationsHub" ]',
  'tag = "v2-backup-transfer-runner"',
  'new_sqlite_classes = [ "BackupTransferRunner" ]',
];

function requireSafeValue(name, value) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${name} is required`);
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new Error(`${name} contains unsupported characters`);
  }
  return normalized;
}

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label}, found ${matches.length}`);
  }
  return source.replace(pattern, replacement);
}

function assertMarkerCount(source, marker) {
  const count = source.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one required config marker ${JSON.stringify(marker)}, found ${count}`);
  }
}

export function renderWranglerConfig(source, values) {
  const accountId = requireSafeValue('CLOUDFLARE_ACCOUNT_ID', values.accountId);
  const databaseId = requireSafeValue('CLOUDFLARE_D1_DATABASE_ID', values.databaseId);
  const r2Bucket = requireSafeValue('CLOUDFLARE_R2_BUCKET', values.r2Bucket);

  if (/^account_id\s*=/m.test(source)) throw new Error('Source config already contains account_id');
  if (/^database_id\s*=/m.test(source)) throw new Error('Source config already contains database_id');
  for (const marker of REQUIRED_CONFIG_MARKERS) assertMarkerCount(source, marker);

  let rendered = replaceExactlyOnce(
    source,
    /^(compatibility_date\s*=\s*"[^"]+")$/gm,
    `$1\naccount_id = "${accountId}"`,
    'compatibility_date'
  );
  rendered = replaceExactlyOnce(
    rendered,
    /^(database_name\s*=\s*"nodewarden-db")$/gm,
    `$1\ndatabase_id = "${databaseId}"`,
    'nodewarden-db database_name'
  );
  rendered = replaceExactlyOnce(
    rendered,
    /^bucket_name\s*=\s*"nodewarden-attachments"$/gm,
    `bucket_name = "${r2Bucket}"`,
    'nodewarden-attachments bucket_name'
  );

  for (const marker of REQUIRED_CONFIG_MARKERS) assertMarkerCount(rendered, marker);
  return rendered;
}

async function main() {
  const sourcePath = process.argv[2] || 'wrangler.toml';
  const outputPath = process.argv[3] || 'wrangler.ci.toml';
  const source = await readFile(sourcePath, 'utf8');
  const rendered = renderWranglerConfig(source, {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    r2Bucket: process.env.CLOUDFLARE_R2_BUCKET,
  });
  await writeFile(outputPath, rendered, { encoding: 'utf8', mode: 0o600 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
