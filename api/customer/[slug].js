import { isAuthenticated, isOrgAuthenticated, getShareTokenFromRequest } from '../_lib/auth.js';
import { getCustomerBySlug, verifyShareToken, getAnnotations, customerHasStoredPat, recordCustomerView } from '../_lib/db.js';
import { json } from '../_lib/handler.js';
import { validateShareToken, validateSlug } from '../_lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const slug = validateSlug(req.query?.slug || '');
  if (!slug) {
    return json(res, 400, { error: 'Invalid slug' });
  }

  const isAdmin = await isAuthenticated(req);
  const isOrgAuth = await isOrgAuthenticated(req, slug);
  const rawShareToken = getShareTokenFromRequest(req);
  const shareToken = rawShareToken ? validateShareToken(rawShareToken) : null;
  let isShareAuth = false;

  if (!isAdmin && !isOrgAuth) {
    if (shareToken) {
      const tokenSlug = await verifyShareToken(shareToken);
      isShareAuth = tokenSlug === slug;
    }
    if (!isShareAuth) {
      return json(res, 401, { error: 'Authentication required', needsOrgAuth: true });
    }
  }

  try {
    const [customer, annotations, hasPat] = await Promise.all([
      getCustomerBySlug(slug),
      getAnnotations(slug),
      isAdmin ? customerHasStoredPat(slug) : Promise.resolve(false),
    ]);

    if (!customer) {
      return json(res, 404, { error: 'Customer model not found' });
    }

    if (!isAdmin) {
      recordCustomerView(slug).catch(() => {});
    }

    const response = {
      slug: customer.slug,
      orgName: customer.orgName,
      orgId: customer.orgId,
      model: customer.model,
      discoveredAt: customer.discoveredAt,
      lastRefreshed: customer.lastRefreshed,
      annotations,
      isAdmin,
    };

    if (isAdmin) {
      response.snapshots = customer.snapshots || [];
      response.hasPat = hasPat;
    }

    return json(res, 200, response);
  } catch (error) {
    console.error('Customer fetch error:', error);
    return json(res, 500, { error: 'Failed to load customer model' });
  }
}
