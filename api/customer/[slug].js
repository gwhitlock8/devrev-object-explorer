import { isAuthenticated, isOrgAuthenticated, getShareTokenFromRequest } from '../_lib/auth.js';
import { getCustomerBySlug, verifyShareToken, getAnnotations, getSnapshots, recordCustomerView } from '../_lib/db.js';
import { json } from '../_lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const slug = req.query?.slug;
  if (!slug) {
    return json(res, 400, { error: 'Slug is required' });
  }

  // Check auth: admin, org-level, or share token
  const isAdmin = await isAuthenticated(req);
  const isOrgAuth = await isOrgAuthenticated(req, slug);
  const shareToken = getShareTokenFromRequest(req);
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
    const customer = await getCustomerBySlug(slug);

    if (!customer) {
      return json(res, 404, { error: 'Customer model not found' });
    }

    // Track customer views (non-admin)
    if (!isAdmin) {
      recordCustomerView(slug).catch(() => {}); // fire and forget
    }

    const annotations = await getAnnotations(slug);

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

    // Only include snapshots for admins (for diff view)
    if (isAdmin) {
      const snapshots = await getSnapshots(slug);
      response.snapshots = snapshots;
      response.hasPat = !!customer.encryptedPat;
    }

    return json(res, 200, response);
  } catch (error) {
    console.error('Customer fetch error:', error);
    return json(res, 500, { error: 'Failed to load customer model' });
  }
}
