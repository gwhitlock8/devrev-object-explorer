import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const PAT_ALGO = 'aes-256-gcm';

function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function getPatEncryptionKey() {
  const key = process.env.PAT_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    if (isProduction()) {
      throw new Error('PAT_ENCRYPTION_KEY or JWT_SECRET is required to store PATs');
    }
    return createHash('sha256').update('dev-only-insecure-pat-key').digest();
  }
  return createHash('sha256').update(key).digest();
}

function getLegacyXorKey() {
  const key = process.env.PAT_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  return createHash('sha256').update(key).digest();
}

export async function hashPassword(plaintext) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(plaintext, salt, 64, SCRYPT_OPTIONS);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyLegacySha256(plaintext, stored) {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash || !/^[a-f0-9]+$/i.test(salt) || !/^[a-f0-9]+$/i.test(hash)) {
      return false;
    }
    const attempt = createHash('sha256').update(salt + plaintext).digest('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(attempt, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function verifyPassword(plaintext, stored) {
  if (!stored || typeof stored !== 'string') return false;

  if (!stored.startsWith('scrypt:')) {
    return verifyLegacySha256(plaintext, stored);
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;

  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (expected.length !== 64) return false;
    const attempt = await scryptAsync(plaintext, salt, 64, SCRYPT_OPTIONS);
    return timingSafeEqual(expected, attempt);
  } catch {
    return false;
  }
}

function encryptPatLegacyXor(pat) {
  const key = getLegacyXorKey();
  const iv = randomBytes(16);
  const buf = Buffer.from(pat, 'utf8');
  const encrypted = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    encrypted[i] = buf[i] ^ key[(i + iv[i % 16]) % 32];
  }
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptPatLegacyXor(stored) {
  const key = getLegacyXorKey();
  const [ivHex, encHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decrypted = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ key[(i + iv[i % 16]) % 32];
  }
  return decrypted.toString('utf8');
}

export function encryptPat(pat) {
  const key = getPatEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(PAT_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(pat, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPat(stored) {
  if (!stored || typeof stored !== 'string') return null;

  if (stored.startsWith('v2:')) {
    const parts = stored.split(':');
    if (parts.length !== 4) return null;
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const key = getPatEncryptionKey();
    const decipher = createDecipheriv(PAT_ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  return decryptPatLegacyXor(stored);
}

export function verifyMasterPassword(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
