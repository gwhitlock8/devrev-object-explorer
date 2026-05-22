import { isAuthenticated } from './_lib/auth.js';
import { createShareToken, listShareTokens, deleteShareToken } from './_lib/db.js';
import { json, parseBody } from './_lib/handler.js';

// POST /api/share — create share link (admin only)
// GET /api/share?slug=xxx — list share links for an org (admin only)
// DELETE /api/share — revoke a share link (admin only)
export default async function handler(req, res) {
  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Admin authentication required' });
  }

  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { slug, expiresInHours, createdBy } = body;

      if (!slug) return json(res, 400, { error: 'Slug is required' });
      if (!expiresInHours || expiresInHours < 1) {
        return json(res, 400, { error: 'expiresInHours must be at least 1' });
      }

      const result = await createShareToken(slug, expiresInHours, createdBy || 'unknown');
      return json(res, 200, result);
    } catch (error) {
      console.error('Share create error:', error);
      return json(res, 500, { error: 'Failed to create share link' });
    }
  }

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const slug = url.searchParams.get('slug');
      if (!slug) return json(res, 400, { error: 'Slug query param is required' });

      const tokens = await listShareTokens(slug);
      return json(res, 200, { tokens });
    } catch (error) {
      console.error('Share list error:', error);
      return json(res, 500, { error: 'Failed to list share links' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const body = await parseBody(req);
      const { token } = body;
      if (!token) return json(res, 400, { error: 'Token is required' });

      await deleteShareToken(token);
      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('Share delete error:', error);
      return json(res, 500, { error: 'Failed to revoke share link' });
    }
  }

  return json(res, 405, { error: 'Method not allowed' });
}
