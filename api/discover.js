import { isAuthenticated } from './_lib/auth.js';
import { runDiscovery, slugifyOrgName } from './_lib/discoverLogic.js';
import { saveCustomerModel, saveSnapshot, getCustomerBySlug, getCustomerPat } from './_lib/db.js';
import { json, parseBody } from './_lib/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!(await isAuthenticated(req))) {
    return json(res, 401, { error: 'Admin authentication required' });
  }

  try {
    const body = await parseBody(req);
    const { pat, password, slug: customSlug, refresh } = body;

    // Refresh mode: re-run discovery using stored PAT
    if (refresh && customSlug) {
      const storedPat = await getCustomerPat(customSlug);
      if (!storedPat) {
        return json(res, 400, { error: 'No stored PAT found for this org. Please provide a PAT.' });
      }

      // Save current model as snapshot before overwriting
      const existing = await getCustomerBySlug(customSlug);
      if (existing?.model) {
        await saveSnapshot(customSlug, existing.model);
      }

      const result = await runDiscovery(storedPat);
      await saveCustomerModel({
        slug: customSlug,
        orgName: result.orgName,
        orgId: result.orgId,
        model: result.model,
        pat: storedPat,
      });

      return json(res, 200, { ...result, slug: customSlug, refreshed: true });
    }

    // New discovery mode
    if (!pat) {
      return json(res, 400, { error: 'PAT is required' });
    }

    const result = await runDiscovery(pat);
    const slug = customSlug || slugifyOrgName(result.orgName);

    // Save current model as snapshot if org already exists
    const existing = await getCustomerBySlug(slug);
    if (existing?.model) {
      await saveSnapshot(slug, existing.model);
    }

    const saveData = {
      slug,
      orgName: result.orgName,
      orgId: result.orgId,
      model: result.model,
      pat,
    };

    // Only set password on first creation
    if (password && !existing) {
      saveData.password = password;
    } else if (password) {
      saveData.password = password; // Allow password update
    }

    await saveCustomerModel(saveData);

    return json(res, 200, { ...result, slug });
  } catch (error) {
    console.error('Discovery error:', error);
    return json(res, 500, {
      error: error.message || 'Failed to discover object model',
    });
  }
}
