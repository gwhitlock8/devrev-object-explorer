import { isAuthenticated } from './_lib/auth.js';
import { listCustomers } from './_lib/db.js';
import { json } from './_lib/handler.js';

// GET /api/orgs — list all orgs (admin only)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Admin authentication required' });
  }

  try {
    const orgs = await listCustomers();
    return json(res, 200, { orgs });
  } catch (error) {
    console.error('List orgs error:', error);
    return json(res, 500, { error: 'Failed to list orgs' });
  }
}
