import { isAuthenticated } from './_lib/auth.js';
import { runDiscovery, slugifyOrgName } from './_lib/discoverLogic.js';
import { saveCustomerModel } from './_lib/db.js';
import { json, parseBody } from './_lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Authentication required' });
  }

  try {
    const body = await parseBody(req);
    const { pat } = body;

    if (!pat) {
      return json(res, 400, { error: 'PAT is required' });
    }

    const result = await runDiscovery(pat);
    const slug = slugifyOrgName(result.orgName);

    await saveCustomerModel({
      slug,
      orgName: result.orgName,
      orgId: result.orgId,
      model: result.model,
    });

    return json(res, 200, { ...result, slug });
  } catch (error) {
    console.error('Discovery error:', error);
    return json(res, 500, {
      error: error.message || 'Failed to discover object model',
    });
  }
}
