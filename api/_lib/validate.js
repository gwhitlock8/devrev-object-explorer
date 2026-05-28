const SLUG_RE = /^[a-z0-9-]+$/;
const HEX_ID_RE = /^[a-f0-9]{16}$/;
const SHARE_TOKEN_RE = /^[a-f0-9]{48}$/;
const ANNOTATION_ID_RE = /^[a-f0-9]{16}$/;

export function validateSlug(value) {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase();
  if (!slug || slug.length > 128 || !SLUG_RE.test(slug)) return null;
  return slug;
}

export function validateAnnotationId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  if (!ANNOTATION_ID_RE.test(id)) return null;
  return id;
}

export function validateShareToken(value) {
  if (typeof value !== 'string') return null;
  const token = value.trim().toLowerCase();
  if (!SHARE_TOKEN_RE.test(token)) return null;
  return token;
}

export function sanitizeAnnotationText(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (!trimmed || trimmed.length > 2000) return null;
  return trimmed;
}

export function sanitizeAuthor(value) {
  if (value == null || value === '') return 'DevRev Team';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 100);
  return trimmed || 'DevRev Team';
}

export function validateAnnotationType(value) {
  const allowed = new Set(['context', 'recommendation', 'question', 'highlight']);
  if (typeof value !== 'string' || !allowed.has(value)) return 'context';
  return value;
}

export function validateExpiresInHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 1 || hours > 720) return null;
  return Math.floor(hours);
}
