import { isAuthenticated } from './_lib/auth.js';
import { deleteCustomerOrg } from './_lib/db.js';
import { json, parseBody, safeErrorMessage } from './_lib/handler.js';
import { validateSlug } from './_lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Admin authentication required' });
  }

  try {
    const body = await parseBody(req);
    const slug = validateSlug(body.slug);

    if (!slug) {
      return json(res, 400, { error: 'Invalid slug' });
    }

    await deleteCustomerOrg(slug);
    return json(res, 200, { ok: true, deleted: slug });
  } catch (error) {
    if (error.message === 'Request body too large') {
      return json(res, 413, { error: 'Request body too large' });
    }
    console.error('Delete org error:', error);
    return json(res, 500, { error: safeErrorMessage(error, 'Failed to delete org') });
  }
}
