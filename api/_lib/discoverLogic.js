const BASE = 'https://api.devrev.ai';

function buildHeaders(pat) {
  const token = pat.trim();
  return {
    // DevRev accepts raw PAT or "Bearer <PAT>" — normalize to Bearer per API docs
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchDevOrg(headers) {
  const orgRes = await fetch(`${BASE}/dev-orgs.get`, { method: 'GET', headers });
  if (!orgRes.ok) {
    let detail = '';
    try {
      const err = await orgRes.json();
      detail = err.message || err.detail || '';
    } catch {
      /* non-JSON error body */
    }
    if (orgRes.status === 401 || orgRes.status === 403) {
      throw new Error(
        detail || 'Invalid PAT or insufficient scopes. Ensure the token has dev_org:read and related list scopes.'
      );
    }
    throw new Error(
      detail || `Failed to load organization (${orgRes.status} ${orgRes.statusText})`
    );
  }
  return orgRes.json();
}

// Safely fetch a list endpoint - returns empty on failure
async function safeFetch(url, headers, body = {}) {
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function runDiscovery(pat) {
  const headers = buildHeaders(pat);
  const orgData = await fetchDevOrg(headers);

  const orgName = orgData.dev_org?.display_name || 'Unknown Org';

  // Phase 1: Fetch core objects
  const [partsData, issuesData, ticketsData, accountsData, syncData, schemasData, articlesData, groupsData, opportunitiesData, conversationsData] =
    await Promise.all([
      safeFetch(`${BASE}/parts.list`, headers, { limit: 100 }),
      safeFetch(`${BASE}/works.list`, headers, { limit: 50, type: ['issue'] }),
      safeFetch(`${BASE}/works.list`, headers, { limit: 50, type: ['ticket'] }),
      safeFetch(`${BASE}/accounts.list`, headers, { limit: 50 }),
      safeFetch(`${BASE}/sync-units.list`, headers, { limit: 50 }),
      safeFetch(`${BASE}/custom-objects.list`, headers, { limit: 50 }),
      safeFetch(`${BASE}/articles.list`, headers, { limit: 20 }),
      safeFetch(`${BASE}/groups.list`, headers, { limit: 50 }),
      safeFetch(`${BASE}/works.list`, headers, { limit: 30, type: ['opportunity'] }),
      safeFetch(`${BASE}/conversations.list`, headers, { limit: 20 }),
    ]);

  // Phase 2: Try to fetch links for relationship discovery
  const linksData = await safeFetch(`${BASE}/links.list`, headers, { limit: 100 });

  const parts = partsData?.parts || [];
  const issues = issuesData?.works || [];
  const tickets = ticketsData?.works || [];
  const accounts = accountsData?.accounts || [];
  const syncUnits = syncData?.sync_units || [];
  const customObjects = schemasData?.custom_objects || [];
  const articles = articlesData?.articles || [];
  const groups = groupsData?.groups || [];
  const opportunities = opportunitiesData?.works || [];
  const conversations = conversationsData?.conversations || [];
  const links = linksData?.links || [];

  const model = buildObjectModel({
    org: orgData.dev_org,
    parts,
    issues,
    tickets,
    accounts,
    syncUnits,
    customObjects,
    articles,
    groups,
    opportunities,
    conversations,
    links,
  });

  return {
    orgName,
    orgId: orgData.dev_org?.id,
    model,
  };
}

export function slugifyOrgName(orgName) {
  return orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ------------------------------------------------------------------
// Helpers to extract the object type from a DON id or object
// ------------------------------------------------------------------
function typeFromDon(don) {
  if (!don) return null;
  // don:core:dvrv-us-1:devo/0:issue/12345 → issue
  const parts = don.split(':');
  const last = parts[parts.length - 1]; // e.g. "issue/12345"
  const type = last.split('/')[0];
  return type || null;
}

function friendlyType(raw) {
  const map = {
    issue: 'Issue',
    ticket: 'Ticket',
    opportunity: 'Opportunity',
    product: 'Product',
    capability: 'Capability',
    feature: 'Feature',
    enhancement: 'Enhancement',
    runnable: 'Runnable',
    linkable: 'Linkable',
    account: 'Account',
    conversation: 'Conversation',
    article: 'Article',
    group: 'Group',
    sync_unit: 'Sync Unit',
    rev_org: 'Rev Org',
    dev_user: 'Dev User',
    meeting: 'Meeting',
    contact: 'Contact',
    task: 'Task',
    sprint: 'Sprint',
    tag: 'Tag',
    custom_object: 'Custom Object',
  };
  return map[raw] || raw?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
}

function objLabel(obj) {
  return obj?.display_id || obj?.display_name || obj?.name || obj?.title || obj?.id?.split('/').pop() || '?';
}

// ------------------------------------------------------------------
// Relationship extraction
// ------------------------------------------------------------------

function buildObjectModel(data) {
  const categories = [];
  const typeRelationships = new Map(); // key: "FromType→ToType→label" → { from, to, label, examples[] }

  function addRelationship(fromType, toType, label, example) {
    const key = `${fromType}→${toType}→${label}`;
    if (!typeRelationships.has(key)) {
      typeRelationships.set(key, { from: fromType, to: toType, label, examples: [] });
    }
    const rel = typeRelationships.get(key);
    if (example && rel.examples.length < 3) {
      rel.examples.push(example);
    }
  }

  // --- Extract relationships from part hierarchy ---
  const products = data.parts.filter((p) => p.type === 'product');
  const capabilities = data.parts.filter((p) => p.type === 'capability');
  const features = data.parts.filter((p) => p.type === 'feature');
  const enhancements = data.parts.filter((p) => p.type === 'enhancement');
  const runnables = data.parts.filter((p) => p.type === 'runnable');
  const linkables = data.parts.filter((p) => p.type === 'linkable');

  // Build a lookup of part id → part for labeling
  const partMap = new Map();
  data.parts.forEach((p) => partMap.set(p.id, p));

  data.parts.forEach((part) => {
    if (part.parent_part) {
      const parentId = part.parent_part.id || part.parent_part;
      const parent = partMap.get(parentId);
      const parentType = parent ? friendlyType(parent.type) : 'Product';
      const childType = friendlyType(part.type);
      addRelationship(parentType, childType, 'contains', {
        from: { id: parentId, label: objLabel(parent || { id: parentId }) },
        to: { id: part.id, label: objLabel(part) },
      });
    }
  });

  // --- Issues → Part (applies_to_part) ---
  data.issues.forEach((issue) => {
    const partRef = issue.applies_to_part || issue.part;
    if (partRef) {
      const partId = partRef.id || partRef;
      const part = partMap.get(partId);
      const partType = part ? friendlyType(part.type) : 'Feature';
      addRelationship('Issue', partType, 'applies to', {
        from: { id: issue.id, label: objLabel(issue) },
        to: { id: partId, label: objLabel(part || { id: partId }) },
      });
    }
    // Issues → owned_by (Dev User)
    if (issue.owned_by?.length) {
      const owner = issue.owned_by[0];
      addRelationship('Dev User', 'Issue', 'owns', {
        from: { id: owner.id || owner, label: owner.display_name || objLabel(owner) },
        to: { id: issue.id, label: objLabel(issue) },
      });
    }
    // Issues → sprint
    if (issue.sprint) {
      const sprintRef = issue.sprint;
      addRelationship('Sprint', 'Issue', 'contains', {
        from: { id: sprintRef.id || sprintRef, label: sprintRef.display_id || objLabel(sprintRef) },
        to: { id: issue.id, label: objLabel(issue) },
      });
    }
  });

  // --- Tickets → Account ---
  data.tickets.forEach((ticket) => {
    const acctRef = ticket.rev_org?.account || ticket.account;
    if (acctRef) {
      const acctId = acctRef.id || acctRef;
      addRelationship('Ticket', 'Account', 'filed for', {
        from: { id: ticket.id, label: objLabel(ticket) },
        to: { id: acctId, label: acctRef.display_name || acctId.split('/').pop() },
      });
    }
    // Tickets → Part
    const partRef = ticket.applies_to_part || ticket.part;
    if (partRef) {
      const partId = partRef.id || partRef;
      const part = partMap.get(partId);
      const partType = part ? friendlyType(part.type) : 'Feature';
      addRelationship('Ticket', partType, 'related to', {
        from: { id: ticket.id, label: objLabel(ticket) },
        to: { id: partId, label: objLabel(part || { id: partId }) },
      });
    }
  });

  // --- Opportunities → Account ---
  data.opportunities.forEach((opp) => {
    const acctRef = opp.account || opp.rev_org?.account;
    if (acctRef) {
      const acctId = acctRef.id || acctRef;
      addRelationship('Opportunity', 'Account', 'belongs to', {
        from: { id: opp.id, label: objLabel(opp) },
        to: { id: acctId, label: acctRef.display_name || acctId.split('/').pop() },
      });
    }
    // Opportunity owner
    if (opp.owned_by?.length) {
      const owner = opp.owned_by[0];
      addRelationship('Dev User', 'Opportunity', 'owns', {
        from: { id: owner.id || owner, label: owner.display_name || objLabel(owner) },
        to: { id: opp.id, label: objLabel(opp) },
      });
    }
  });

  // --- Articles → Part ---
  data.articles.forEach((article) => {
    const partRef = article.applies_to_part || article.parent;
    if (partRef) {
      const partId = partRef.id || partRef;
      const part = partMap.get(partId);
      addRelationship('Article', part ? friendlyType(part.type) : 'Product', 'documents', {
        from: { id: article.id, label: objLabel(article) },
        to: { id: partId, label: objLabel(part || { id: partId }) },
      });
    }
  });

  // --- Sync Units → external system ---
  data.syncUnits.forEach((s) => {
    if (s.external_system_display_name) {
      addRelationship('Sync Unit', 'Product', `syncs from ${s.external_system_display_name}`, {
        from: { id: s.id, label: objLabel(s) },
        to: { id: 'external', label: s.external_system_display_name },
      });
    }
  });

  // --- Conversations → ticket (if converted) ---
  data.conversations.forEach((conv) => {
    if (conv.ticket) {
      addRelationship('Conversation', 'Ticket', 'converted to', {
        from: { id: conv.id, label: objLabel(conv) },
        to: { id: conv.ticket.id || conv.ticket, label: objLabel(conv.ticket) },
      });
    }
  });

  // --- Links (explicit cross-object relationships) ---
  data.links.forEach((link) => {
    const sourceType = typeFromDon(link.source?.id || link.source);
    const targetType = typeFromDon(link.target?.id || link.target);
    if (sourceType && targetType) {
      const linkLabel = link.link_type?.replace(/_/g, ' ') || 'linked to';
      addRelationship(friendlyType(sourceType), friendlyType(targetType), linkLabel, {
        from: { id: link.source?.id || link.source, label: objLabel(link.source) },
        to: { id: link.target?.id || link.target, label: objLabel(link.target) },
      });
    }
  });

  // --- Groups → Dev User ---
  data.groups.forEach((g) => {
    if (g.member_count > 0 || g.members?.length) {
      addRelationship('Group', 'Dev User', 'contains', {
        from: { id: g.id, label: objLabel(g) },
        to: { id: 'members', label: `${g.member_count || g.members?.length || '?'} members` },
      });
    }
  });

  // ------------------------------------------------------------------
  // Build categories (for the inventory cards below the graph)
  // ------------------------------------------------------------------

  if (products.length || capabilities.length || features.length) {
    categories.push({
      id: 'product',
      label: 'Product Hierarchy',
      color: '#7ADB12',
      objects: [
        ...products.map((p) => ({ id: p.id, name: p.display_id || p.name, type: 'Product', desc: p.name })),
        ...capabilities.map((p) => ({ id: p.id, name: p.display_id || p.name, type: 'Capability', desc: p.name })),
        ...features.map((p) => ({ id: p.id, name: p.display_id || p.name, type: 'Feature', desc: p.name })),
        ...enhancements.slice(0, 10).map((p) => ({ id: p.id, name: p.display_id || p.name, type: 'Enhancement', desc: p.name })),
        ...runnables.map((p) => ({ id: p.id, name: p.display_id || p.name, type: 'Runnable', desc: p.name })),
        ...linkables.map((p) => ({ id: p.id, name: p.display_id || p.name, type: 'Linkable', desc: p.name })),
      ],
    });
  }

  if (data.accounts.length) {
    categories.push({
      id: 'accounts',
      label: 'Accounts',
      color: '#8854F6',
      objects: data.accounts.slice(0, 20).map((a) => ({
        id: a.id,
        name: a.display_name || a.display_id,
        type: 'Account',
        desc: a.domains?.join(', ') || '',
      })),
    });
  }

  const workObjects = [];
  if (data.issues.length) {
    const subtypes = [...new Set(data.issues.map((i) => i.subtype).filter(Boolean))];
    workObjects.push({
      id: 'issues',
      name: `Issues (${data.issues.length}+)`,
      type: 'Issue',
      desc: subtypes.length ? `Subtypes: ${subtypes.slice(0, 5).join(', ')}` : 'Engineering work items',
    });
  }
  if (data.tickets.length) {
    const subtypes = [...new Set(data.tickets.map((t) => t.subtype).filter(Boolean))];
    workObjects.push({
      id: 'tickets',
      name: `Tickets (${data.tickets.length}+)`,
      type: 'Ticket',
      desc: subtypes.length ? `Subtypes: ${subtypes.slice(0, 5).join(', ')}` : 'Customer requests',
    });
  }
  if (data.opportunities.length) {
    workObjects.push({
      id: 'opportunities',
      name: `Opportunities (${data.opportunities.length}+)`,
      type: 'Opportunity',
      desc: 'Active sales deals',
    });
  }
  if (workObjects.length) {
    categories.push({
      id: 'work',
      label: 'Work Items',
      color: '#3968F6',
      objects: workObjects,
    });
  }

  if (data.syncUnits.length) {
    categories.push({
      id: 'integrations',
      label: 'AirSync Connections',
      color: '#FFE600',
      objects: data.syncUnits.slice(0, 15).map((s) => ({
        id: s.id,
        name: s.display_id || s.name || s.id,
        type: 'Sync Unit',
        desc: s.external_system_display_name || s.sync_pack?.display_name || '',
      })),
    });
  }

  if (data.customObjects.length) {
    categories.push({
      id: 'custom',
      label: 'Custom Objects',
      color: '#F35106',
      objects: data.customObjects.slice(0, 15).map((c) => ({
        id: c.id,
        name: c.display_id || c.type_name || c.id,
        type: 'Custom Object',
        desc: c.type_name || '',
      })),
    });
  }

  if (data.articles.length) {
    categories.push({
      id: 'knowledge',
      label: 'Knowledge Base',
      color: '#C90651',
      objects: data.articles.slice(0, 10).map((a) => ({
        id: a.id,
        name: a.title || a.display_id,
        type: 'Article',
        desc: '',
      })),
    });
  }

  if (data.groups.length) {
    categories.push({
      id: 'groups',
      label: 'Groups & Teams',
      color: '#5996FF',
      objects: data.groups.slice(0, 10).map((g) => ({
        id: g.id,
        name: g.name || g.display_id,
        type: 'Group',
        desc: `${g.member_count || 0} members`,
      })),
    });
  }

  if (data.conversations.length) {
    categories.push({
      id: 'conversations',
      label: 'Conversations',
      color: '#C90651',
      objects: data.conversations.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.display_id || c.id,
        type: 'Conversation',
        desc: c.title || '',
      })),
    });
  }

  // Convert the relationship map to an array
  const relationships = [...typeRelationships.values()];

  const stats = {
    totalParts: data.parts.length,
    totalAccounts: data.accounts.length,
    totalSyncUnits: data.syncUnits.length,
    totalArticles: data.articles.length,
    totalGroups: data.groups.length,
    totalOpportunities: data.opportunities.length,
    totalConversations: data.conversations.length,
    hasIssues: data.issues.length > 0,
    hasTickets: data.tickets.length > 0,
  };

  return { categories, relationships, stats };
}
