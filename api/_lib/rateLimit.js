import { getDb } from './db.js';

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.get?.('x-forwarded-for');
  if (forwarded) return String(forwarded).split(',')[0].trim();
  const realIp = req.headers?.['x-real-ip'] || req.headers?.get?.('x-real-ip');
  if (realIp) return String(realIp).trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function getRateLimitKey(req, scope) {
  return `${scope}:${getClientIp(req)}`;
}

export async function checkRateLimit(key, { limit = 10, windowSec = 900 } = {}) {
  const database = await getDb();
  if (!database) {
    return { allowed: true };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSec * 1000);
  const coll = database.collection('rate_limits');

  const existing = await coll.findOne({ key });
  if (!existing || existing.windowStart < windowStart) {
    await coll.updateOne(
      { key },
      { $set: { key, count: 1, windowStart: now } },
      { upsert: true }
    );
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.windowStart.getTime() + windowSec * 1000 - now.getTime()) / 1000) };
  }

  await coll.updateOne({ key }, { $inc: { count: 1 } });
  return { allowed: true, remaining: limit - existing.count - 1 };
}

export async function enforceRateLimit(req, res, json, key, options) {
  const result = await checkRateLimit(key, options);
  if (!result.allowed) {
    json(res, 429, {
      error: 'Too many attempts. Please try again later.',
      retryAfterSec: result.retryAfterSec,
    });
    return false;
  }
  return true;
}
