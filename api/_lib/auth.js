import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'devrev_session';
export const ORG_COOKIE_PREFIX = 'devrev_org_';

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export async function signSessionToken() {
  return new SignJWT({ authenticated: true, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecretKey());
}

export async function signOrgToken(slug) {
  return new SignJWT({ authenticated: true, role: 'org', slug })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecretKey());
}

export async function verifySessionToken(token, { role, slug } = {}) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload?.authenticated !== true) return null;
    if (role) {
      const tokenRole = payload.role || 'admin';
      if (tokenRole !== role) return null;
    }
    if (slug && payload.slug !== slug) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function getTokenFromRequest(req) {
  const cookieHeader = req.headers?.cookie || req.headers?.get?.('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const auth = req.headers?.authorization || req.headers?.get?.('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function getOrgTokenFromRequest(req, slug) {
  const cookieHeader = req.headers?.cookie || req.headers?.get?.('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  return cookies[`${ORG_COOKIE_PREFIX}${slug}`] || null;
}

export async function isAuthenticated(req) {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  const payload = await verifySessionToken(token, { role: 'admin' });
  return !!payload;
}

export async function isOrgAuthenticated(req, slug) {
  if (await isAuthenticated(req)) return true;
  const orgToken = getOrgTokenFromRequest(req, slug);
  if (!orgToken) return false;
  const payload = await verifySessionToken(orgToken, { role: 'org', slug });
  return !!payload;
}

export function getShareTokenFromRequest(req) {
  const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const token = url.searchParams.get('token');
  if (!token || typeof token !== 'string') return null;
  return token.trim().toLowerCase();
}

function cookieSecureFlag() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

export function setSessionCookie(res, token) {
  const secure = cookieSecureFlag();
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=86400',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function setOrgCookie(res, slug, token) {
  const secure = cookieSecureFlag();
  const parts = [
    `${ORG_COOKIE_PREFIX}${slug}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=43200',
  ];
  if (secure) parts.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    const cookies = Array.isArray(existing) ? existing : [existing];
    cookies.push(parts.join('; '));
    res.setHeader('Set-Cookie', cookies);
  } else {
    res.setHeader('Set-Cookie', parts.join('; '));
  }
}

export function clearSessionCookie(res) {
  const secure = cookieSecureFlag();
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAllAuthCookies(res) {
  res.setHeader('Clear-Site-Data', '"cookies"');
  clearSessionCookie(res);
}
