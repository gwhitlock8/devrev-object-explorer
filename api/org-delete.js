import { isAuthenticated } from './_lib/auth.js';
import { deleteCustomerOrg } from './_lib/db.js';
import { json, parseBody } from './_lib/handler.js';

// POST /api/org-delete — delete an org and all its data (admin only)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Admin authentication required' });
  }

  try {
    const body = await parseBody(req);
    const { slug } = body;

    if (!slug) {
      return json(res, 400, { error: 'Slug is required' });
    }

    await deleteCustomerOrg(slug);
    return json(res, 200, { ok: true, deleted: slug });
  } catch (error) {
    console.error('Delete org error:', error);
    return json(res, 500, { error: error.message || 'Failed to delete org' });
  }
}
