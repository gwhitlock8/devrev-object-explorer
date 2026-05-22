import { isAuthenticated } from '../_lib/auth.js';
import { getCustomerBySlug } from '../_lib/db.js';
import { json } from '../_lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Authentication required' });
  }

  const slug = req.query?.slug;
  if (!slug) {
    return json(res, 400, { error: 'Slug is required' });
  }

  try {
    const customer = await getCustomerBySlug(slug);

    if (!customer) {
      return json(res, 404, { error: 'Customer model not found' });
    }

    return json(res, 200, {
      slug: customer.slug,
      orgName: customer.orgName,
      orgId: customer.orgId,
      model: customer.model,
      discoveredAt: customer.discoveredAt,
      lastRefreshed: customer.lastRefreshed,
    });
  } catch (error) {
    console.error('Customer fetch error:', error);
    return json(res, 500, { error: 'Failed to load customer model' });
  }
}
