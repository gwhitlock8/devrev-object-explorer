import { isAuthenticated, isOrgAuthenticated } from './_lib/auth.js';
import { addAnnotation, deleteAnnotation, getAnnotations } from './_lib/db.js';
import { json, parseBody, safeErrorMessage } from './_lib/handler.js';
import {
  sanitizeAnnotationText,
  sanitizeAuthor,
  validateAnnotationId,
  validateAnnotationType,
  validateSlug,
} from './_lib/validate.js';

function sanitizeOptionalString(value, maxLen) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || null;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    if (!(await isAuthenticated(req))) {
      return json(res, 401, { error: 'Admin authentication required' });
    }

    try {
      const body = await parseBody(req);
      const slug = validateSlug(body.slug);
      const text = sanitizeAnnotationText(body.text);
      const author = sanitizeAuthor(body.author);
      const annotationType = validateAnnotationType(body.annotationType);

      if (!slug) return json(res, 400, { error: 'Invalid slug' });
      if (!text) return json(res, 400, { error: 'Text is required (max 2000 characters)' });
      if (author === null) return json(res, 400, { error: 'Invalid author' });

      const annotation = await addAnnotation(slug, {
        nodeType: sanitizeOptionalString(body.nodeType, 128),
        edgeKey: sanitizeOptionalString(body.edgeKey, 256),
        annotationType,
        text,
        author,
      });

      return json(res, 200, annotation);
    } catch (error) {
      if (error.message === 'Request body too large') {
        return json(res, 413, { error: 'Request body too large' });
      }
      console.error('Annotation create error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Failed to add annotation') });
    }
  }

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slug = validateSlug(url.searchParams.get('slug') || '');
    if (!slug) return json(res, 400, { error: 'Invalid slug' });

    if (!(await isOrgAuthenticated(req, slug))) {
      return json(res, 401, { error: 'Authentication required' });
    }

    try {
      const annotations = await getAnnotations(slug);
      return json(res, 200, { annotations });
    } catch (error) {
      console.error('Annotation list error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Failed to list annotations') });
    }
  }

  if (req.method === 'DELETE') {
    if (!(await isAuthenticated(req))) {
      return json(res, 401, { error: 'Admin authentication required' });
    }

    try {
      const body = await parseBody(req);
      const slug = validateSlug(body.slug);
      const id = validateAnnotationId(body.id);

      if (!slug) return json(res, 400, { error: 'Invalid slug' });
      if (!id) return json(res, 400, { error: 'Invalid annotation id' });

      const deleted = await deleteAnnotation(id, slug);
      if (!deleted) {
        return json(res, 404, { error: 'Annotation not found' });
      }
      return json(res, 200, { ok: true });
    } catch (error) {
      if (error.message === 'Request body too large') {
        return json(res, 413, { error: 'Request body too large' });
      }
      console.error('Annotation delete error:', error);
      return json(res, 500, { error: safeErrorMessage(error, 'Failed to delete annotation') });
    }
  }

  return json(res, 405, { error: 'Method not allowed' });
}
