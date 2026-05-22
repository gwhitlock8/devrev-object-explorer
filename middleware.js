import { verifySessionToken, COOKIE_NAME, parseCookies } from './api/_lib/auth.js';

export const config = {
  matcher: ['/customer/:path+', '/api/discover', '/api/customer/:path*'],
};

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (pathname === '/customer' || pathname === '/customer/') {
    return;
  }

  const cookies = parseCookies(request.headers.get('cookie') || '');
  const token = cookies[COOKIE_NAME];
  const authenticated = token ? await verifySessionToken(token) : false;

  if (authenticated) {
    return;
  }

  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const loginUrl = new URL('/customer', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return Response.redirect(loginUrl, 302);
}
