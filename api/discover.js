// Serverless function: /api/discover
// Takes a DevRev PAT and discovers the customer's object model
// Returns objects, relationships, and sync units

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pat } = req.body;

  if (!pat) {
    return res.status(400).json({ error: 'PAT is required' });
  }

  const headers = {
    'Authorization': pat,
    'Content-Type': 'application/json',
  };

  const BASE = 'https://api.devrev.ai';

  try {
    // 1. Get org info (dev-orgs.self)
    const orgRes = await fetch(`${BASE}/dev-orgs.self`, { method: 'GET', headers });
    if (!orgRes.ok) throw new Error(`Auth failed: ${orgRes.status} ${orgRes.statusText}`);
    const orgData = await orgRes.json();
    const orgName = orgData.dev_org?.display_name || 'Unknown Org';

    // 2. Discover parts (products, capabilities, features, enhancements, runnables, linkables)
    const partsRes = await fetch(`${BASE}/parts.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 100 }),
    });
    const partsData = partsRes.ok ? await partsRes.json() : { parts: [] };

    // 3. Discover work types (issues, tickets, incidents)
    // Get a sample to understand what subtypes exist
    const issuesRes = await fetch(`${BASE}/works.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50, type: ['issue'] }),
    });
    const issuesData = issuesRes.ok ? await issuesRes.json() : { works: [] };

    const ticketsRes = await fetch(`${BASE}/works.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50, type: ['ticket'] }),
    });
    const ticketsData = ticketsRes.ok ? await ticketsRes.json() : { works: [] };

    // 4. Discover accounts
    const accountsRes = await fetch(`${BASE}/accounts.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });
    const accountsData = accountsRes.ok ? await accountsRes.json() : { accounts: [] };

    // 5. Discover sync units (AirSync connections)
    const syncRes = await fetch(`${BASE}/sync-units.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });
    const syncData = syncRes.ok ? await syncRes.json() : { sync_units: [] };

    // 6. Discover custom objects (schemas)
    const schemasRes = await fetch(`${BASE}/custom-objects.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });
    const schemasData = schemasRes.ok ? await schemasRes.json() : { custom_objects: [] };

    // 7. Discover articles
    const articlesRes = await fetch(`${BASE}/articles.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 20 }),
    });
    const articlesData = articlesRes.ok ? await articlesRes.json() : { articles: [] };

    // 8. Discover groups
    const groupsRes = await fetch(`${BASE}/groups.list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });
    const groupsData = groupsRes.ok ? await groupsRes.json() : { groups: [] };

    // Process and structure the results
    const model = buildObjectModel({
      org: orgData.dev_org,
      parts: partsData.parts || [],
      issues: issuesData.works || [],
      tickets: ticketsData.works || [],
      accounts: accountsData.accounts || [],
      syncUnits: syncData.sync_units || [],
      customObjects: schemasData.custom_objects || [],
      articles: articlesData.articles || [],
      groups: groupsData.groups || [],
    });

    return res.status(200).json({
      orgName,
      orgId: orgData.dev_org?.id,
      model,
    });

  } catch (error) {
    console.error('Discovery error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to discover object model',
    });
  }
}

function buildObjectModel(data) {
  const categories = [];
  const relationships = [];
  const stats = {
    totalParts: data.parts.length,
    totalAccounts: data.accounts.length,
    totalSyncUnits: data.syncUnits.length,
    totalArticles: data.articles.length,
    totalGroups: data.groups.length,
    hasIssues: data.issues.length > 0,
    hasTickets: data.tickets.length > 0,
  };

  // Product hierarchy
  const products = data.parts.filter(p => p.type === 'product');
  const capabilities = data.parts.filter(p => p.type === 'capability');
  const features = data.parts.filter(p => p.type === 'feature');
  const enhancements = data.parts.filter(p => p.type === 'enhancement');
  const runnables = data.parts.filter(p => p.type === 'runnable');
  const linkables = data.parts.filter(p => p.type === 'linkable');

  if (products.length || capabilities.length || features.length) {
    categories.push({
      id: 'product',
      label: 'Product Hierarchy',
      color: '#7ADB12',
      objects: [
        ...products.map(p => ({ id: p.id, name: p.display_id || p.name, type: 'Product', desc: p.name })),
        ...capabilities.map(p => ({ id: p.id, name: p.display_id || p.name, type: 'Capability', desc: p.name })),
        ...features.map(p => ({ id: p.id, name: p.display_id || p.name, type: 'Feature', desc: p.name })),
        ...enhancements.slice(0, 10).map(p => ({ id: p.id, name: p.display_id || p.name, type: 'Enhancement', desc: p.name })),
        ...runnables.map(p => ({ id: p.id, name: p.display_id || p.name, type: 'Runnable', desc: p.name })),
        ...linkables.map(p => ({ id: p.id, name: p.display_id || p.name, type: 'Linkable', desc: p.name })),
      ],
    });
  }

  // Build parent-child relationships from parts
  data.parts.forEach(part => {
    if (part.parent_part) {
      relationships.push({
        from: part.parent_part.id || part.parent_part,
        to: part.id,
        label: 'contains',
      });
    }
  });

  // Accounts
  if (data.accounts.length) {
    categories.push({
      id: 'accounts',
      label: 'Accounts',
      color: '#8854F6',
      objects: data.accounts.slice(0, 20).map(a => ({
        id: a.id,
        name: a.display_name || a.display_id,
        type: 'Account',
        desc: a.domains?.join(', ') || '',
      })),
    });
  }

  // Work items summary
  const workObjects = [];
  if (data.issues.length) {
    // Get unique subtypes
    const subtypes = [...new Set(data.issues.map(i => i.subtype).filter(Boolean))];
    workObjects.push({ id: 'issues', name: `Issues (${data.issues.length}+)`, type: 'Issue', desc: subtypes.length ? `Subtypes: ${subtypes.slice(0, 5).join(', ')}` : 'Engineering work items' });
  }
  if (data.tickets.length) {
    const subtypes = [...new Set(data.tickets.map(t => t.subtype).filter(Boolean))];
    workObjects.push({ id: 'tickets', name: `Tickets (${data.tickets.length}+)`, type: 'Ticket', desc: subtypes.length ? `Subtypes: ${subtypes.slice(0, 5).join(', ')}` : 'Customer requests' });
  }
  if (workObjects.length) {
    categories.push({
      id: 'work',
      label: 'Work Items',
      color: '#3968F6',
      objects: workObjects,
    });
  }

  // Sync Units (external connections)
  if (data.syncUnits.length) {
    categories.push({
      id: 'integrations',
      label: 'AirSync Connections',
      color: '#FFE600',
      objects: data.syncUnits.slice(0, 15).map(s => ({
        id: s.id,
        name: s.display_id || s.name || s.id,
        type: 'Sync Unit',
        desc: s.external_system_display_name || s.sync_pack?.display_name || '',
      })),
    });

    // Relationships: sync units import into the object model
    data.syncUnits.forEach(s => {
      if (s.external_system_display_name) {
        relationships.push({
          from: s.id,
          to: 'shared-memory',
          label: `syncs from ${s.external_system_display_name}`,
        });
      }
    });
  }

  // Custom objects
  if (data.customObjects.length) {
    categories.push({
      id: 'custom',
      label: 'Custom Objects',
      color: '#F35106',
      objects: data.customObjects.slice(0, 15).map(c => ({
        id: c.id,
        name: c.display_id || c.type_name || c.id,
        type: 'Custom Object',
        desc: c.type_name || '',
      })),
    });
  }

  // Articles / Knowledge
  if (data.articles.length) {
    categories.push({
      id: 'knowledge',
      label: 'Knowledge Base',
      color: '#C90651',
      objects: data.articles.slice(0, 10).map(a => ({
        id: a.id,
        name: a.title || a.display_id,
        type: 'Article',
        desc: '',
      })),
    });
  }

  // Groups
  if (data.groups.length) {
    categories.push({
      id: 'groups',
      label: 'Groups & Teams',
      color: '#5996FF',
      objects: data.groups.slice(0, 10).map(g => ({
        id: g.id,
        name: g.name || g.display_id,
        type: 'Group',
        desc: `${g.member_count || 0} members`,
      })),
    });
  }

  return { categories, relationships, stats };
}
