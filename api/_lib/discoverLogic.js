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
  const [partsData, issuesData, ticketsData, accountsData, syncData, schemasData, articlesData, groupsData, opportunitiesData, conversationsData, contactsData, meetingsData, tagsData, devUsersData] =
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
      safeFetch(`${BASE}/rev-users.list`, headers, { limit: 50 }),
      safeFetch(`${BASE}/meetings.list`, headers, { limit: 30 }),
      safeFetch(`${BASE}/tags.list`, headers, { limit: 50 }),
      safeFetch(`${BASE}/dev-users.list`, headers, { limit: 30 }),
    ]);

  // Phase 2: Additional data sources
  const [linksData, vistasData, revOrgsData, slaPoliciesData, snapInsData] =
    await Promise.all([
      safeFetch(`${BASE}/links.list`, headers, { limit: 100 }),
      safeFetch(`${BASE}/vistas.list`, headers, { limit: 30 }),
      safeFetch(`${BASE}/rev-orgs.list`, headers, { limit: 30 }),
      safeFetch(`${BASE}/sla-policies.list`, headers, { limit: 20 }),
      safeFetch(`${BASE}/snap-ins.list`, headers, { limit: 30 }),
    ]);

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
  const contacts = contactsData?.rev_users || [];
  const meetings = meetingsData?.meetings || [];
  const tags = tagsData?.tags || [];
  const devUsers = devUsersData?.dev_users || [];
  const links = linksData?.links || [];
  const vistas = vistasData?.vistas || [];
  const revOrgs = revOrgsData?.rev_orgs || [];
  const slaPolicies = slaPoliciesData?.sla_policies || [];
  const snapIns = snapInsData?.snap_ins || [];

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
    contacts,
    meetings,
    tags,
    devUsers,
    links,
    vistas,
    revOrgs,
    slaPolicies,
    snapIns,
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

  // --- Contacts → Account ---
  (data.contacts || []).forEach((contact) => {
    const acctRef = contact.rev_org?.account || contact.account;
    if (acctRef) {
      const acctId = acctRef.id || acctRef;
      addRelationship('Contact', 'Account', 'associated with', {
        from: { id: contact.id, label: objLabel(contact) },
        to: { id: acctId, label: acctRef.display_name || acctId.split('/').pop() },
      });
    }
  });

  // --- Meetings → Opportunity / Account / Contact ---
  (data.meetings || []).forEach((meeting) => {
    if (meeting.opportunity) {
      const oppRef = meeting.opportunity;
      addRelationship('Meeting', 'Opportunity', 'related to', {
        from: { id: meeting.id, label: objLabel(meeting) },
        to: { id: oppRef.id || oppRef, label: objLabel(oppRef) },
      });
    }
    if (meeting.account) {
      const acctRef = meeting.account;
      addRelationship('Meeting', 'Account', 'scheduled for', {
        from: { id: meeting.id, label: objLabel(meeting) },
        to: { id: acctRef.id || acctRef, label: acctRef.display_name || objLabel(acctRef) },
      });
    }
    if (meeting.members?.length) {
      const member = meeting.members[0];
      addRelationship('Meeting', 'Contact', 'involves', {
        from: { id: meeting.id, label: objLabel(meeting) },
        to: { id: member.id || member, label: member.display_name || objLabel(member) },
      });
    }
  });

  // --- Tags → applied objects ---
  (data.tags || []).forEach((tag) => {
    if (tag.name) {
      addRelationship('Tag', 'Issue', 'applied to', {
        from: { id: tag.id, label: tag.name },
        to: { id: 'various', label: 'work items' },
      });
    }
  });

  // --- Vistas → Space / Dev User ---
  (data.vistas || []).forEach((vista) => {
    if (vista.space) {
      addRelationship('Vista', 'Space', 'belongs to', {
        from: { id: vista.id, label: objLabel(vista) },
        to: { id: vista.space.id || vista.space, label: objLabel(vista.space) },
      });
    }
    if (vista.owned_by?.length) {
      const owner = vista.owned_by[0];
      addRelationship('Dev User', 'Vista', 'owns', {
        from: { id: owner.id || owner, label: owner.display_name || objLabel(owner) },
        to: { id: vista.id, label: objLabel(vista) },
      });
    }
  });

  // --- Rev Orgs → Account ---
  (data.revOrgs || []).forEach((revOrg) => {
    if (revOrg.account) {
      const acctRef = revOrg.account;
      addRelationship('Rev Org', 'Account', 'belongs to', {
        from: { id: revOrg.id, label: objLabel(revOrg) },
        to: { id: acctRef.id || acctRef, label: acctRef.display_name || objLabel(acctRef) },
      });
    }
  });

  // --- SLA Policies → Ticket types ---
  (data.slaPolicies || []).forEach((sla) => {
    addRelationship('SLA Policy', 'Ticket', 'governs', {
      from: { id: sla.id, label: sla.name || objLabel(sla) },
      to: { id: 'tickets', label: 'matching tickets' },
    });
    // SLA may reference parts
    if (sla.applies_to_part) {
      const partRef = sla.applies_to_part;
      const partId = partRef.id || partRef;
      const part = partMap.get(partId);
      addRelationship('SLA Policy', part ? friendlyType(part.type) : 'Product', 'scoped to', {
        from: { id: sla.id, label: sla.name || objLabel(sla) },
        to: { id: partId, label: objLabel(part || { id: partId }) },
      });
    }
  });

  // --- Snap-ins (Automations) → various objects ---
  (data.snapIns || []).forEach((snapIn) => {
    const name = snapIn.name || snapIn.display_name || objLabel(snapIn);
    // Snap-ins connect external systems to internal actions
    if (snapIn.snap_in_version?.spec?.commands?.length) {
      addRelationship('Automation', 'Issue', 'acts on', {
        from: { id: snapIn.id, label: name },
        to: { id: 'work items', label: 'triggered actions' },
      });
    }
    // General automation presence
    addRelationship('Automation', 'Sync Unit', 'integrates via', {
      from: { id: snapIn.id, label: name },
      to: { id: 'system', label: snapIn.status || 'active' },
    });
  });

  // --- Pipeline stage enrichment (from opportunities) ---
  const stageDistribution = new Map();
  (data.opportunities || []).forEach((opp) => {
    const stage = opp.stage?.name || opp.stage || opp.state;
    if (stage) {
      stageDistribution.set(stage, (stageDistribution.get(stage) || 0) + 1);
    }
  });

  // --- Custom fields extraction ---
  const customFieldsByType = new Map();
  const sampleObjects = [
    ...data.issues.slice(0, 3).map((o) => ({ ...o, _type: 'Issue' })),
    ...data.tickets.slice(0, 3).map((o) => ({ ...o, _type: 'Ticket' })),
    ...data.opportunities.slice(0, 3).map((o) => ({ ...o, _type: 'Opportunity' })),
    ...data.accounts.slice(0, 3).map((o) => ({ ...o, _type: 'Account' })),
  ];
  sampleObjects.forEach((obj) => {
    const type = obj._type;
    if (!customFieldsByType.has(type)) customFieldsByType.set(type, new Set());
    const customs = obj.custom_fields || obj.custom_schema_fragments;
    if (customs && typeof customs === 'object') {
      Object.keys(customs).forEach((key) => {
        customFieldsByType.get(type).add(key);
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

  if (data.contacts?.length) {
    categories.push({
      id: 'contacts',
      label: 'Contacts',
      color: '#8854F6',
      objects: data.contacts.slice(0, 15).map((c) => ({
        id: c.id,
        name: c.display_name || c.full_name || c.display_id || c.id,
        type: 'Contact',
        desc: c.email || c.rev_org?.display_name || '',
      })),
    });
  }

  if (data.meetings?.length) {
    categories.push({
      id: 'meetings',
      label: 'Meetings',
      color: '#F35106',
      objects: data.meetings.slice(0, 10).map((m) => ({
        id: m.id,
        name: m.title || m.display_id || m.id,
        type: 'Meeting',
        desc: m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '',
      })),
    });
  }

  if (data.tags?.length) {
    categories.push({
      id: 'tags',
      label: 'Tags',
      color: '#FFE600',
      objects: data.tags.slice(0, 15).map((t) => ({
        id: t.id,
        name: t.name || t.display_id || t.id,
        type: 'Tag',
        desc: t.description || '',
      })),
    });
  }

  if (data.devUsers?.length) {
    categories.push({
      id: 'devusers',
      label: 'Dev Users',
      color: '#5996FF',
      objects: data.devUsers.slice(0, 10).map((u) => ({
        id: u.id,
        name: u.display_name || u.full_name || u.display_id || u.id,
        type: 'Dev User',
        desc: u.email || '',
      })),
    });
  }

  if (data.vistas?.length) {
    categories.push({
      id: 'vistas',
      label: 'Views & Boards',
      color: '#5996FF',
      objects: data.vistas.slice(0, 10).map((v) => ({
        id: v.id,
        name: v.name || v.display_id || v.id,
        type: 'Vista',
        desc: v.type || '',
      })),
    });
  }

  if (data.revOrgs?.length) {
    categories.push({
      id: 'revorgs',
      label: 'Customer Organizations',
      color: '#8854F6',
      objects: data.revOrgs.slice(0, 15).map((r) => ({
        id: r.id,
        name: r.display_name || r.display_id || r.id,
        type: 'Rev Org',
        desc: r.account?.display_name || '',
      })),
    });
  }

  if (data.slaPolicies?.length) {
    categories.push({
      id: 'sla',
      label: 'SLA Policies',
      color: '#F35106',
      objects: data.slaPolicies.slice(0, 10).map((s) => ({
        id: s.id,
        name: s.name || s.display_id || s.id,
        type: 'SLA Policy',
        desc: s.description || '',
      })),
    });
  }

  if (data.snapIns?.length) {
    categories.push({
      id: 'automations',
      label: 'Automations & Snap-ins',
      color: '#FF93AC',
      objects: data.snapIns.slice(0, 10).map((s) => ({
        id: s.id,
        name: s.name || s.display_name || s.display_id || s.id,
        type: 'Automation',
        desc: s.status || '',
      })),
    });
  }

  // Pipeline stage distribution (enrichment for opportunities)
  if (stageDistribution.size > 0) {
    categories.push({
      id: 'pipeline',
      label: 'Pipeline Stages',
      color: '#F35106',
      objects: [...stageDistribution.entries()].map(([stage, count]) => ({
        id: `stage-${stage}`,
        name: stage,
        type: 'Stage',
        desc: `${count} deal${count > 1 ? 's' : ''}`,
      })),
    });
  }

  // Custom fields per object type
  if (customFieldsByType.size > 0) {
    const cfObjects = [];
    customFieldsByType.forEach((fields, type) => {
      if (fields.size > 0) {
        cfObjects.push({
          id: `cf-${type}`,
          name: type,
          type: 'Custom Fields',
          desc: `${fields.size} field${fields.size > 1 ? 's' : ''}: ${[...fields].slice(0, 4).join(', ')}${fields.size > 4 ? '...' : ''}`,
        });
      }
    });
    if (cfObjects.length > 0) {
      categories.push({
        id: 'customfields',
        label: 'Custom Fields',
        color: '#FFAD76',
        objects: cfObjects,
      });
    }
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
    totalContacts: data.contacts?.length || 0,
    totalMeetings: data.meetings?.length || 0,
    totalTags: data.tags?.length || 0,
    totalDevUsers: data.devUsers?.length || 0,
    totalVistas: data.vistas?.length || 0,
    totalRevOrgs: data.revOrgs?.length || 0,
    totalSlaPolicies: data.slaPolicies?.length || 0,
    totalAutomations: data.snapIns?.length || 0,
    pipelineStages: stageDistribution.size,
    customFieldTypes: customFieldsByType.size,
    hasIssues: data.issues.length > 0,
    hasTickets: data.tickets.length > 0,
  };

  return { categories, relationships, stats };
}
