import { signSessionToken, setSessionCookie, clearAllAuthCookies } from './_lib/auth.js';
import { verifyMasterPassword } from './_lib/secrets.js';
import { json, parseBody, safeErrorMessage } from './_lib/handler.js';
import { enforceRateLimit, getRateLimitKey } from './_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const allowed = await enforceRateLimit(
        req,
        res,
        json,
        getRateLimitKey(req, 'auth'),
        { limit: 10, windowSec: 900 }
      );
      if (!allowed) return;

      const body = await parseBody(req);
      const { password } = body;
      const expected = process.env.CUSTOMER_PASSWORD;

      if (!expected) {
        return json(res, 500, { error: 'CUSTOMER_PASSWORD is not configured' });
      }

      if (typeof password !== 'string' || !verifyMasterPassword(password, expected)) {
        return json(res, 401, { error: 'Invalid password' });
      }

      const token = await signSessionToken();
      setSessionCookie(res, token);
      return json(res, 200, { ok: true });
    } catch (error) {
      if (error.message === 'Request body too large') {
        return json(res, 413, { error: 'Request body too large' });
      }
      console.error('Auth error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Authentication failed') });
    }
  }

  if (req.method === 'DELETE') {
    clearAllAuthCookies(res);
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
