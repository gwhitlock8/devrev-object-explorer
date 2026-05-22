import { isAuthenticated } from './_lib/auth.js';
import { json } from './_lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  return json(res, 200, { authenticated: await isAuthenticated(req) });
}
