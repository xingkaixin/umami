import crypto from 'node:crypto';
import { startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { v4, v5, v7 } from 'uuid';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENC_POSITION = TAG_POSITION + TAG_LENGTH;

const HASH_ALGO = 'sha512';
const HASH_ENCODING = 'hex';

const getKey = (password: string, salt: Buffer) =>
  crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha512');

export function encrypt(value: any, secret: any) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(secret, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(value: any, secret: any) {
  const str = Buffer.from(String(value), 'base64');
  const salt = str.subarray(0, SALT_LENGTH);
  const iv = str.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = str.subarray(TAG_POSITION, ENC_POSITION);
  const encrypted = str.subarray(ENC_POSITION);

  const key = getKey(secret, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

export function hash(...args: string[]) {
  return crypto.createHash(HASH_ALGO).update(args.join('')).digest(HASH_ENCODING);
}

export function md5(...args: string[]) {
  return crypto.createHash('md5').update(args.join('')).digest('hex');
}

const APP_SECRET_PLACEHOLDER = 'replace-with-a-random-64-character-hex-string';

export function secret() {
  const value = process.env.APP_SECRET;
  const trimmed = value?.trim();

  if (!trimmed || trimmed === APP_SECRET_PLACEHOLDER) {
    throw new Error('APP_SECRET must be set to a random secret, not empty or the example value.');
  }

  // Hash the raw value: changing the input would change derived visitor ids and invalidate tokens.
  return hash(value);
}

export function uuid(...args: any) {
  if (args.length) {
    return v5(hash(...args, secret()), v5.DNS);
  }

  return process.env.USE_UUIDV7 ? v7() : v4();
}

export function createAuthKey() {
  return crypto.randomBytes(16).toString('hex');
}

export function getSalt(saltRotation: string, createdAt: Date): string {
  const period = saltRotation?.trim().toLowerCase();
  const startOfPeriod = ['day', 'daily'].includes(period)
    ? startOfDay
    : ['week', 'weekly'].includes(period)
      ? startOfWeek
      : startOfMonth;

  return hash(startOfPeriod(createdAt).toUTCString());
}
