import { getTokenFromRequest, verifySessionToken } from './_lib/auth.js';
import { json } from './_lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return json(res, 200, { authenticated: false });
  }

  const payload = await verifySessionToken(token);
  if (!payload) {
    return json(res, 200, { authenticated: false });
  }

  return json(res, 200, { authenticated: true, role: payload.role || 'admin' });
}
