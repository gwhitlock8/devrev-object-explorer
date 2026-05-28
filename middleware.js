import { getTokenFromRequest, verifySessionToken } from './api/_lib/auth.js';

export const config = {
  matcher: ['/api/discover', '/api/orgs', '/api/share', '/api/annotations', '/api/org-delete'],
};

export default async function middleware(request) {
  const token = getTokenFromRequest(request);
  const payload = token ? await verifySessionToken(token, { role: 'admin' }) : null;

  if (!payload) {
    return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return;
}
