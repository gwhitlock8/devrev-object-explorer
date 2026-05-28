import { isAuthenticated } from './_lib/auth.js';
import { runDiscovery, slugifyOrgName } from './_lib/discoverLogic.js';
import { saveCustomerModel, saveSnapshot, getCustomerBySlug, getCustomerPat } from './_lib/db.js';
import { json, parseBody, safeErrorMessage } from './_lib/handler.js';
import { validateSlug } from './_lib/validate.js';

function discoverErrorMessage(error) {
  const msg = error?.message || '';
  if (msg.includes('PAT_ENCRYPTION_KEY') || msg.includes('JWT_SECRET') || msg.includes('store PATs')) {
    return 'Server encryption is not configured. Set PAT_ENCRYPTION_KEY (recommended) or JWT_SECRET in Vercel environment variables.';
  }
  if (msg.includes('MONGODB_URI') || msg.includes('Database connection')) {
    return 'Database connection failed. Check MONGODB_URI in Vercel environment variables.';
  }
  return safeErrorMessage(error, 'Failed to discover object model');
}

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

    if (refresh && customSlug) {
      const slug = validateSlug(customSlug);
      if (!slug) {
        return json(res, 400, { error: 'Invalid slug' });
      }

      const submittedPat = typeof pat === 'string' ? pat.trim() : '';
      const storedPat = submittedPat || await getCustomerPat(slug);
      if (!storedPat) {
        return json(res, 400, { error: 'No stored PAT found for this org. Please provide a PAT.' });
      }

      const existing = await getCustomerBySlug(slug);
      if (existing?.model) {
        await saveSnapshot(slug, existing.model);
      }

      const result = await runDiscovery(storedPat);
      await saveCustomerModel({
        slug,
        orgName: result.orgName,
        orgId: result.orgId,
        model: result.model,
        pat: storedPat,
      });

      return json(res, 200, { ...result, slug, refreshed: true });
    }

    if (typeof pat !== 'string' || !pat.trim()) {
      return json(res, 400, { error: 'PAT is required' });
    }

    const result = await runDiscovery(pat.trim());
    const slug = customSlug ? validateSlug(customSlug) : slugifyOrgName(result.orgName);
    if (!slug) {
      return json(res, 400, { error: 'Invalid slug' });
    }

    const existing = await getCustomerBySlug(slug);
    if (existing?.model) {
      await saveSnapshot(slug, existing.model);
    }

    const saveData = {
      slug,
      orgName: result.orgName,
      orgId: result.orgId,
      model: result.model,
      pat: pat.trim(),
    };

    if (typeof password === 'string' && password) {
      if (password.length < 8 || password.length > 128) {
        return json(res, 400, { error: 'Password must be 8–128 characters' });
      }
      saveData.password = password;
    }

    await saveCustomerModel(saveData);

    return json(res, 200, { ...result, slug });
  } catch (error) {
    if (error.message === 'Request body too large') {
      return json(res, 413, { error: 'Request body too large' });
    }
    console.error('Discovery error:', error);
    return json(res, 500, {
      error: discoverErrorMessage(error),
    });
  }
}
