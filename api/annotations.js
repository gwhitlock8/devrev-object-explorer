import { isAuthenticated, isOrgAuthenticated } from './_lib/auth.js';
import { addAnnotation, deleteAnnotation, getAnnotations } from './_lib/db.js';
import { json, parseBody } from './_lib/handler.js';

// POST /api/annotations — add annotation (admin only)
// GET /api/annotations?slug=xxx — list annotations (org auth or admin)
// DELETE /api/annotations — remove annotation (admin only)
export default async function handler(req, res) {
  if (req.method === 'POST') {
    if (!(await isAuthenticated(req))) {
      return json(res, 401, { error: 'Admin authentication required' });
    }

    try {
      const body = await parseBody(req);
      const { slug, nodeType, edgeKey, text, author } = body;

      if (!slug) return json(res, 400, { error: 'Slug is required' });
      if (!text) return json(res, 400, { error: 'Text is required' });

      const annotation = await addAnnotation(slug, {
        nodeType: nodeType || null,
        edgeKey: edgeKey || null,
        text,
        author: author || 'DevRev Team',
      });

      return json(res, 200, annotation);
    } catch (error) {
      console.error('Annotation create error:', error);
      return json(res, 500, { error: 'Failed to add annotation' });
    }
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slug = url.searchParams.get('slug');
    if (!slug) return json(res, 400, { error: 'Slug query param is required' });

    if (!(await isOrgAuthenticated(req, slug))) {
      return json(res, 401, { error: 'Authentication required' });
    }

    try {
      const annotations = await getAnnotations(slug);
      return json(res, 200, { annotations });
    } catch (error) {
      console.error('Annotation list error:', error);
      return json(res, 500, { error: 'Failed to list annotations' });
    }
  }

  if (req.method === 'DELETE') {
    if (!(await isAuthenticated(req))) {
      return json(res, 401, { error: 'Admin authentication required' });
    }

    try {
      const body = await parseBody(req);
      const { id } = body;
      if (!id) return json(res, 400, { error: 'Annotation id is required' });

      await deleteAnnotation(id);
      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('Annotation delete error:', error);
      return json(res, 500, { error: 'Failed to delete annotation' });
    }
  }

  return json(res, 405, { error: 'Method not allowed' });
}
