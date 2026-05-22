import { signOrgToken, setOrgCookie } from './_lib/auth.js';
import { verifyOrgPassword, verifyShareToken } from './_lib/db.js';
import { json, parseBody } from './_lib/handler.js';

// POST /api/org-auth — authenticate with org password or share token
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { slug, password, shareToken } = body;

    if (!slug) {
      return json(res, 400, { error: 'Slug is required' });
    }

    // Option 1: Share token auth
    if (shareToken) {
      const tokenSlug = await verifyShareToken(shareToken);
      if (tokenSlug === slug) {
        const token = await signOrgToken(slug);
        setOrgCookie(res, slug, token);
        return json(res, 200, { ok: true, role: 'viewer' });
      }
      return json(res, 401, { error: 'Invalid or expired share link' });
    }

    // Option 2: Password auth
    if (!password) {
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
    console.error('Org auth error:', error);
    return json(res, 500, { error: 'Authentication failed' });
  }
}
