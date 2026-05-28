export function hashRelationships(relationships) {
  return relationships
    .map((r) => `${r.from}|${r.to}|${r.label}`)
    .sort()
    .join('\n');
}

export function computeLayout(nodes, edges, width, height) {
  const padding = 80;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - padding;

  const positions = new Map();
  const angleStep = (2 * Math.PI) / nodes.length;

  nodes.forEach((node, i) => {
    const angle = angleStep * i - Math.PI / 2;
    positions.set(node, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  });

  const iterations = 60;
  const repulsion = 8000;
  const attraction = 0.005;
  const damping = 0.85;

  const velocities = new Map();
  nodes.forEach((n) => velocities.set(n, { vx: 0, vy: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i]);
        const b = positions.get(nodes[j]);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const va = velocities.get(nodes[i]);
        const vb = velocities.get(nodes[j]);
        va.vx += fx;
        va.vy += fy;
        vb.vx -= fx;
        vb.vy -= fy;
      }
    }

    edges.forEach((edge) => {
      const a = positions.get(edge.from);
      const b = positions.get(edge.to);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const va = velocities.get(edge.from);
      const vb = velocities.get(edge.to);
      if (va) {
        va.vx += fx;
        va.vy += fy;
      }
      if (vb) {
        vb.vx -= fx;
        vb.vy -= fy;
      }
    });

    nodes.forEach((node) => {
      const pos = positions.get(node);
      const vel = velocities.get(node);
      vel.vx += (centerX - pos.x) * 0.001;
      vel.vy += (centerY - pos.y) * 0.001;
    });

    nodes.forEach((node) => {
      const pos = positions.get(node);
      const vel = velocities.get(node);
      vel.vx *= damping;
      vel.vy *= damping;
      pos.x += vel.vx;
      pos.y += vel.vy;
      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    });
  }

  return positions;
}

export function computeNeighborhood(selectedEdge, hoveredNode, edges) {
  const edgeTier = new Map();
  const nodeTier = new Map();
  const highlightedEdges = new Set();
  const highlightedNodes = new Set();
  let upstreamEdges = [];
  let downstreamEdges = [];

  if (selectedEdge) {
    edgeTier.set(selectedEdge.index, 0);
    nodeTier.set(selectedEdge.from, 0);
    nodeTier.set(selectedEdge.to, 0);
    highlightedEdges.add(selectedEdge.index);
    highlightedNodes.add(selectedEdge.from);
    highlightedNodes.add(selectedEdge.to);

    const tier1Nodes = new Set();
    edges.forEach((e) => {
      if (e.index === selectedEdge.index) return;
      if (
        e.from === selectedEdge.from ||
        e.to === selectedEdge.from ||
        e.from === selectedEdge.to ||
        e.to === selectedEdge.to
      ) {
        if (!edgeTier.has(e.index)) edgeTier.set(e.index, 1);
        highlightedEdges.add(e.index);
        [e.from, e.to].forEach((n) => {
          highlightedNodes.add(n);
          if (!nodeTier.has(n)) {
            nodeTier.set(n, 1);
            tier1Nodes.add(n);
          }
        });
      }
    });

    edges.forEach((e) => {
      if (edgeTier.has(e.index)) return;
      if (tier1Nodes.has(e.from) || tier1Nodes.has(e.to)) {
        edgeTier.set(e.index, 2);
        highlightedEdges.add(e.index);
        [e.from, e.to].forEach((n) => {
          highlightedNodes.add(n);
          if (!nodeTier.has(n)) nodeTier.set(n, 2);
        });
      }
    });

    const fromNode = selectedEdge.from;
    const toNode = selectedEdge.to;

    upstreamEdges = edges
      .filter((e) => e.to === fromNode && e.index !== selectedEdge.index)
      .map((e) => ({ ...e, hop: 1 }));
    const upstreamSources = upstreamEdges.map((e) => e.from);
    const upstream2 = edges.filter(
      (e) =>
        upstreamSources.includes(e.to) &&
        e.index !== selectedEdge.index &&
        !upstreamEdges.find((u) => u.index === e.index)
    );
    upstreamEdges = [...upstreamEdges, ...upstream2.map((e) => ({ ...e, hop: 2 }))];

    const intoTarget = edges
      .filter(
        (e) =>
          e.to === toNode &&
          e.index !== selectedEdge.index &&
          !upstreamEdges.find((u) => u.index === e.index)
      )
      .map((e) => ({ ...e, hop: 1 }));
    upstreamEdges = [...upstreamEdges, ...intoTarget];

    downstreamEdges = edges
      .filter((e) => e.from === toNode && e.index !== selectedEdge.index)
      .map((e) => ({ ...e, hop: 1 }));
    const downstreamTargets = downstreamEdges.map((e) => e.to);
    const downstream2 = edges.filter(
      (e) =>
        downstreamTargets.includes(e.from) &&
        e.index !== selectedEdge.index &&
        !downstreamEdges.find((d) => d.index === e.index)
    );
    downstreamEdges = [...downstreamEdges, ...downstream2.map((e) => ({ ...e, hop: 2 }))];

    const outFromSource = edges
      .filter(
        (e) =>
          e.from === fromNode &&
          e.index !== selectedEdge.index &&
          !downstreamEdges.find((d) => d.index === e.index)
      )
      .map((e) => ({ ...e, hop: 1 }));
    downstreamEdges = [...downstreamEdges, ...outFromSource];
  } else if (hoveredNode) {
    highlightedNodes.add(hoveredNode);
    nodeTier.set(hoveredNode, 0);
    edges.forEach((e) => {
      if (e.from === hoveredNode || e.to === hoveredNode) {
        highlightedEdges.add(e.index);
        edgeTier.set(e.index, 0);
        highlightedNodes.add(e.from);
        highlightedNodes.add(e.to);
        if (!nodeTier.has(e.from)) nodeTier.set(e.from, 1);
        if (!nodeTier.has(e.to)) nodeTier.set(e.to, 1);
      }
    });
  }

  return {
    edgeTier,
    nodeTier,
    highlightedEdges,
    highlightedNodes,
    upstreamEdges,
    downstreamEdges,
    hasSelection: !!(selectedEdge || hoveredNode),
  };
}

export function groupAnnotations(annotations) {
  const nodeAnnotations = new Map();
  const edgeAnnotations = new Map();
  annotations.forEach((a) => {
    if (a.nodeType) {
      if (!nodeAnnotations.has(a.nodeType)) nodeAnnotations.set(a.nodeType, []);
      nodeAnnotations.get(a.nodeType).push(a);
    } else if (a.edgeKey) {
      if (!edgeAnnotations.has(a.edgeKey)) edgeAnnotations.set(a.edgeKey, []);
      edgeAnnotations.get(a.edgeKey).push(a);
    }
  });
  return { nodeAnnotations, edgeAnnotations };
}
