import { verifySessionToken, COOKIE_NAME, ORG_COOKIE_PREFIX, parseCookies } from './api/_lib/auth.js';

export const config = {
  matcher: ['/api/discover', '/api/orgs', '/api/share', '/api/annotations'],
};

// Only protect admin-only API routes at the middleware level.
// Org-level and share-token auth is handled inside individual route handlers
// since they need access to the slug and DB.
export default async function middleware(request) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const token = cookies[COOKIE_NAME];
  const payload = token ? await verifySessionToken(token) : null;
  const isAdmin = payload?.role === 'admin';

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Admin is authenticated, proceed
  return;
}
