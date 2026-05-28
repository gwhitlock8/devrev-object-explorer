import { isAuthenticated } from './_lib/auth.js';
import { createShareToken, listShareTokens, deleteShareToken } from './_lib/db.js';
import { json, parseBody, safeErrorMessage } from './_lib/handler.js';
import { validateExpiresInHours, validateShareToken, validateSlug } from './_lib/validate.js';

export default async function handler(req, res) {
  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Admin authentication required' });
  }

  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const slug = validateSlug(body.slug);
      const expiresInHours = validateExpiresInHours(body.expiresInHours);

      if (!slug) return json(res, 400, { error: 'Invalid slug' });
      if (!expiresInHours) {
        return json(res, 400, { error: 'expiresInHours must be between 1 and 720' });
      }

      const createdBy = typeof body.createdBy === 'string'
        ? body.createdBy.trim().slice(0, 100) || 'unknown'
        : 'unknown';

      const result = await createShareToken(slug, expiresInHours, createdBy);
      return json(res, 200, result);
    } catch (error) {
      if (error.message === 'Request body too large') {
        return json(res, 413, { error: 'Request body too large' });
      }
      console.error('Share create error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Failed to create share link') });
    }
  }

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const slug = validateSlug(url.searchParams.get('slug') || '');
      if (!slug) return json(res, 400, { error: 'Invalid slug' });

      const tokens = await listShareTokens(slug);
      return json(res, 200, { tokens });
    } catch (error) {
      console.error('Share list error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Failed to list share links') });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const body = await parseBody(req);
      const slug = validateSlug(body.slug);
      const token = validateShareToken(body.token);

      if (!slug) return json(res, 400, { error: 'Invalid slug' });
      if (!token) return json(res, 400, { error: 'Invalid token' });

      const deleted = await deleteShareToken(token, slug);
      if (!deleted) {
        return json(res, 404, { error: 'Share link not found' });
      }
      return json(res, 200, { ok: true });
    } catch (error) {
      if (error.message === 'Request body too large') {
        return json(res, 413, { error: 'Request body too large' });
      }
      console.error('Share delete error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Failed to revoke share link') });
    }
  }

  return json(res, 405, { error: 'Method not allowed' });
}
