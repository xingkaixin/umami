import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import config from '../cloudflare.config';
import { hashPassword } from '../src/lib/password';

const target = process.argv[2];
if (!['--local', '--remote'].includes(target))
  throw new Error('Choose --local or --remote explicitly.');
const username = (process.env.UMAMI_ADMIN_USERNAME || 'admin').toLowerCase();
const password = process.env.UMAMI_ADMIN_PASSWORD;
if (!password || password.length < 12)
  throw new Error('Set UMAMI_ADMIN_PASSWORD to at least 12 characters.');
if (!username || username.length > 255) throw new Error('Invalid administrator username.');
const id = randomUUID();
const directory = await mkdtemp(join(tmpdir(), 'umami-admin-'));
try {
  const file = join(directory, 'admin.json');
  await writeFile(
    file,
    JSON.stringify({
      sql: "insert into user (user_id, username, password, role) values (?, ?, ?, 'admin')",
      params: [id, username, hashPassword(password)],
    }),
    { mode: 0o600 },
  );
  const result = spawnSync(
    'cf',
    [
      'd1',
      'raw',
      config.worker.env.DB.id,
      '--body',
      `@${file}`,
      ...(target === '--local' ? ['--local', '--persist-to', '.wrangler/state'] : []),
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.info(`Created administrator ${username} (${id}).`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
