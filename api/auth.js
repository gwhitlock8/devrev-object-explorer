import { signSessionToken, setSessionCookie, clearSessionCookie } from './_lib/auth.js';
import { json, parseBody } from './_lib/handler.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { password } = body;
      const expected = process.env.CUSTOMER_PASSWORD;

      if (!expected) {
        return json(res, 500, { error: 'CUSTOMER_PASSWORD is not configured' });
      }

      if (!password || password !== expected) {
        return json(res, 401, { error: 'Invalid password' });
      }

      const token = await signSessionToken();
      setSessionCookie(res, token);
      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('Auth error:', error);
      return json(res, 500, { error: 'Authentication failed' });
    }
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
