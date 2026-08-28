import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const directory = await mkdtemp(join(tmpdir(), 'umami-admin-'));
try {
  const file = join(directory, 'admin.sql');
  await writeFile(
    file,
    `insert into user (user_id, username, password, role) values (${quote(id)}, ${quote(username)}, ${quote(hashPassword(password))}, 'admin');`,
    { mode: 0o600 },
  );
  const result = spawnSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'DB', target, '--file', file],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.info(`Created administrator ${username} (${id}).`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
