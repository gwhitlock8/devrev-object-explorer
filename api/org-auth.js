import { signOrgToken, setOrgCookie } from './_lib/auth.js';
import { verifyOrgPassword, verifyShareToken } from './_lib/db.js';
import { json, parseBody, safeErrorMessage } from './_lib/handler.js';
import { enforceRateLimit, getRateLimitKey } from './_lib/rateLimit.js';
import { validateShareToken, validateSlug } from './_lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const slug = validateSlug(body.slug);

    if (!slug) {
      return json(res, 400, { error: 'Invalid slug' });
    }

    const allowed = await enforceRateLimit(
      req,
      res,
      json,
      `${getRateLimitKey(req, 'org-auth')}:${slug}`,
      { limit: 10, windowSec: 900 }
    );
    if (!allowed) return;

    if (body.shareToken) {
      const shareToken = validateShareToken(body.shareToken);
      if (!shareToken) {
        return json(res, 400, { error: 'Invalid share token format' });
      }
      const tokenSlug = await verifyShareToken(shareToken);
      if (tokenSlug === slug) {
        const token = await signOrgToken(slug);
        setOrgCookie(res, slug, token);
        return json(res, 200, { ok: true, role: 'viewer' });
      }
      return json(res, 401, { error: 'Invalid or expired share link' });
    }

    const { password } = body;
    if (typeof password !== 'string' || !password) {
      return json(res, 400, { error: 'Password is required' });
    }

    const valid = await verifyOrgPassword(slug, password);
    if (!valid) {
      return json(res, 401, { error: 'Invalid password' });
    }

    const token = await signOrgToken(slug);
    setOrgCookie(res, slug, token);
    return json(res, 200, { ok: true, role: 'org' });
  } catch (error) {
    if (error.message === 'Request body too large') {
      return json(res, 413, { error: 'Request body too large' });
    }
    console.error('Org auth error:', error);
    return json(res, 500, { error: safeErrorMessage(error, 'Authentication failed') });
  }
}
