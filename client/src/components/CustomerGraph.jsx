import { useCallback, useEffect, useRef, useState } from 'react';
import './CustomerGraph.css';

// Color palette for node types
const TYPE_COLORS = {
  Product: '#7ADB12',
  Capability: '#7ADB12',
  Feature: '#7ADB12',
  Enhancement: '#7ADB12',
  Runnable: '#7ADB12',
  Linkable: '#7ADB12',
  Account: '#8854F6',
  Issue: '#3968F6',
  Ticket: '#3968F6',
  Opportunity: '#F35106',
  'Dev User': '#5996FF',
  Sprint: '#FFE600',
  'Sync Unit': '#FFAD76',
  Article: '#C90651',
  Conversation: '#C90651',
  Group: '#5996FF',
  'Custom Object': '#F35106',
};

const TYPE_ICONS = {
  Product: '📦',
  Capability: '⚙️',
  Feature: '🔧',
  Enhancement: '🚀',
  Runnable: '🖥️',
  Linkable: '🔗',
  Account: '🏢',
  Issue: '🐛',
  Ticket: '🎫',
  Opportunity: '💰',
  'Dev User': '👩‍💻',
  Sprint: '🏃',
  'Sync Unit': '🔄',
  Article: '📄',
  Conversation: '💬',
  Group: '👥',
  'Custom Object': '⭐',
  Meeting: '📅',
  Contact: '👤',
  Tag: '🏷️',
  Task: '✅',
  'Rev Org': '🏢',
};

const ANNOTATION_TYPE_ICONS = {
  context: '💬',
  recommendation: '💡',
  question: '❓',
  highlight: '⭐',
};

const ANNOTATION_TYPE_COLORS = {
  context: '#5996FF',
  recommendation: '#7ADB12',
  question: '#FFE600',
  highlight: '#F35106',
};

function getIcon(type) {
  return TYPE_ICONS[type] || '●';
}

function getColor(type) {
  return TYPE_COLORS[type] || '#a5a2a4';
}

// Simple force-directed layout simulation
function computeLayout(nodes, edges, width, height) {
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
        va.vx += fx; va.vy += fy;
        vb.vx -= fx; vb.vy -= fy;
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
      if (va) { va.vx += fx; va.vy += fy; }
      if (vb) { vb.vx -= fx; vb.vy -= fy; }
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
      vel.vx *= damping; vel.vy *= damping;
      pos.x += vel.vx; pos.y += vel.vy;
      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    });
  }

  return positions;
}

export default function CustomerGraph({ relationships, orgName, annotations = [] }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [positions, setPositions] = useState(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const animRef = useRef(null);
  const dotsRef = useRef([]);

  // Extract unique node types from relationships
  const nodeTypes = [...new Set(relationships.flatMap((r) => [r.from, r.to]))];
  const edges = relationships.map((r, i) => ({ from: r.from, to: r.to, label: r.label, examples: r.examples, index: i }));

  // Group annotations by target
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

  const annotationCount = annotations.length;

  // Compute layout
  useEffect(() => {
    const w = dimensions.width;
    const h = dimensions.height;
    if (nodeTypes.length === 0) return;
    const pos = computeLayout(nodeTypes, edges, w, h);
    setPositions(pos);
  }, [relationships, dimensions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animate dots along edges
  useEffect(() => {
    if (!positions || edges.length === 0) return;

    const dots = edges.map((_, i) => ({
      progress: Math.random(),
      speed: 0.002 + Math.random() * 0.001,
      index: i,
    }));
    dotsRef.current = dots;

    const frame = () => {
      dots.forEach((d) => {
        d.progress += d.speed;
        if (d.progress > 1) d.progress = 0;
      });
      dots.forEach((d) => {
        const el = document.getElementById(`graph-dot-${d.index}`);
        const pathEl = document.getElementById(`graph-edge-${d.index}`);
        if (!el || !pathEl) return;
        try {
          const len = pathEl.getTotalLength();
          const pt = pathEl.getPointAtLength(d.progress * len);
          el.setAttribute('cx', pt.x);
          el.setAttribute('cy', pt.y);
        } catch { /* path not ready */ }
      });
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [positions, edges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdgeClick = useCallback((edge, e) => {
    e.stopPropagation();
    setSelectedEdge((prev) => (prev?.index === edge.index ? null : edge));
    setSelectedAnnotation(null);
  }, []);

  const handleNodeClick = useCallback((nodeType) => {
    setHoveredNode((prev) => (prev === nodeType ? null : nodeType));
    setSelectedEdge(null);
    setSelectedAnnotation(null);
  }, []);

  const handleAnnotationClick = useCallback((annotation, e) => {
    e.stopPropagation();
    setSelectedAnnotation((prev) => (prev?.id === annotation.id ? null : annotation));
    setSelectedEdge(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEdge(null);
    setHoveredNode(null);
    setSelectedAnnotation(null);
  }, []);

  if (!positions || nodeTypes.length === 0) {
    return (
      <div className="customer-graph-empty">
        <p>No relationships discovered. The org may need more data or broader PAT scopes.</p>
      </div>
    );
  }

  // --- Compute 2-hop neighborhood for edge selection ---
  // Tier 0: the clicked edge itself (boldest)
  // Tier 1: edges directly connected to either node of the clicked edge
  // Tier 2: edges one more hop out from tier 1 nodes
  const edgeTier = new Map(); // edge.index → 0 | 1 | 2
  const nodeTier = new Map(); // nodeType → 0 | 1 | 2
  const highlightedEdges = new Set();
  const highlightedNodes = new Set();

  // Build upstream/downstream data for panel
  let upstreamEdges = [];
  let downstreamEdges = [];

  if (selectedEdge) {
    // Tier 0: the selected edge and its nodes
    edgeTier.set(selectedEdge.index, 0);
    nodeTier.set(selectedEdge.from, 0);
    nodeTier.set(selectedEdge.to, 0);
    highlightedEdges.add(selectedEdge.index);
    highlightedNodes.add(selectedEdge.from);
    highlightedNodes.add(selectedEdge.to);

    // Tier 1: all edges touching either anchor node
    const tier1Nodes = new Set();
    edges.forEach((e) => {
      if (e.index === selectedEdge.index) return;
      if (e.from === selectedEdge.from || e.to === selectedEdge.from ||
          e.from === selectedEdge.to || e.to === selectedEdge.to) {
        if (!edgeTier.has(e.index)) edgeTier.set(e.index, 1);
        highlightedEdges.add(e.index);
        [e.from, e.to].forEach((n) => {
          highlightedNodes.add(n);
          if (!nodeTier.has(n)) { nodeTier.set(n, 1); tier1Nodes.add(n); }
        });
      }
    });

    // Tier 2: edges touching tier 1 nodes (but not already in tier 0/1)
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

    // Build upstream (edges pointing INTO from/to nodes) and downstream (edges going OUT)
    const fromNode = selectedEdge.from;
    const toNode = selectedEdge.to;

    // Upstream: things that feed into the "from" node
    upstreamEdges = edges
      .filter((e) => e.to === fromNode && e.index !== selectedEdge.index)
      .map((e) => ({ ...e, hop: 1 }));
    // Second hop upstream
    const upstreamSources = upstreamEdges.map((e) => e.from);
    const upstream2 = edges.filter((e) => upstreamSources.includes(e.to) && e.index !== selectedEdge.index && !upstreamEdges.find((u) => u.index === e.index));
    upstreamEdges = [...upstreamEdges, ...upstream2.map((e) => ({ ...e, hop: 2 }))];

    // Also include edges going into the "to" node (besides the selected one)
    const intoTarget = edges
      .filter((e) => e.to === toNode && e.index !== selectedEdge.index && !upstreamEdges.find((u) => u.index === e.index))
      .map((e) => ({ ...e, hop: 1 }));
    upstreamEdges = [...upstreamEdges, ...intoTarget];

    // Downstream: things that flow out from the "to" node
    downstreamEdges = edges
      .filter((e) => e.from === toNode && e.index !== selectedEdge.index)
      .map((e) => ({ ...e, hop: 1 }));
    // Second hop downstream
    const downstreamTargets = downstreamEdges.map((e) => e.to);
    const downstream2 = edges.filter((e) => downstreamTargets.includes(e.from) && e.index !== selectedEdge.index && !downstreamEdges.find((d) => d.index === e.index));
    downstreamEdges = [...downstreamEdges, ...downstream2.map((e) => ({ ...e, hop: 2 }))];

    // Also include edges going out from the "from" node (besides the selected one)
    const outFromSource = edges
      .filter((e) => e.from === fromNode && e.index !== selectedEdge.index && !downstreamEdges.find((d) => d.index === e.index))
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

  const hasSelection = selectedEdge || hoveredNode;
  const NODE_RADIUS = 28;

  return (
    <div className="customer-graph-wrapper" onClick={clearSelection}>
      {/* Annotation layer toggle */}
      {annotationCount > 0 && (
        <button
          type="button"
          className={`annotation-toggle ${showAnnotations ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowAnnotations(!showAnnotations); }}
        >
          {showAnnotations ? '🏷 Hide' : '🏷 Show'} notes ({annotationCount})
        </button>
      )}

      <div className="customer-graph-container" ref={containerRef}>
        <svg
          className="customer-graph-svg"
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          <defs>
            <filter id="node-glow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const curv = Math.min(dist * 0.15, 30);
            const nx = (-dy / (dist || 1)) * curv * 0.3;
            const ny = (dx / (dist || 1)) * curv * 0.3;
            const cx = (from.x + to.x) / 2 + nx;
            const cy = (from.y + to.y) / 2 + ny;

            const isHighlighted = highlightedEdges.has(edge.index);
            const isDimmed = hasSelection && !isHighlighted;
            const tier = edgeTier.get(edge.index);
            const edgeKey = `${edge.from}→${edge.to}→${edge.label}`;
            const hasAnnotation = showAnnotations && edgeAnnotations.has(edgeKey);

            // Tier-based styling
            let strokeColor = '#4a4a4a';
            let strokeWidth = 1;
            let strokeOpacity = 0.4;

            if (isDimmed) {
              strokeOpacity = 0.08;
            } else if (tier === 0) {
              strokeColor = '#7ADB12';
              strokeWidth = 2.5;
              strokeOpacity = 0.9;
            } else if (tier === 1) {
              strokeColor = '#7ADB12';
              strokeWidth = 1.5;
              strokeOpacity = 0.5;
            } else if (tier === 2) {
              strokeColor = '#5996FF';
              strokeWidth = 1;
              strokeOpacity = 0.3;
            } else if (hasAnnotation) {
              strokeColor = ANNOTATION_TYPE_COLORS[edgeAnnotations.get(edgeKey)[0].annotationType || 'context'];
              strokeWidth = 1.5;
              strokeOpacity = 0.6;
            }

            return (
              <g key={`edge-${edge.index}`}>
                <path
                  d={`M ${from.x} ${from.y} Q ${cx} ${cy}, ${to.x} ${to.y}`}
                  stroke="transparent"
                  strokeWidth="12"
                  fill="none"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleEdgeClick(edge, e)}
                />
                <path
                  id={`graph-edge-${edge.index}`}
                  d={`M ${from.x} ${from.y} Q ${cx} ${cy}, ${to.x} ${to.y}`}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  opacity={strokeOpacity}
                  style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                  onClick={(e) => handleEdgeClick(edge, e)}
                />
                {isHighlighted && (
                  <text x={cx} y={cy - 8} textAnchor="middle" className="edge-label">
                    {edge.label}
                  </text>
                )}
                {/* Edge annotation indicator */}
                {hasAnnotation && !isDimmed && (
                  <g
                    onClick={(e) => handleAnnotationClick(edgeAnnotations.get(edgeKey)[0], e)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={cx} cy={cy + 10} r={8} fill={ANNOTATION_TYPE_COLORS[edgeAnnotations.get(edgeKey)[0].annotationType || 'context']} opacity="0.9" />
                    <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="central" fontSize="9">
                      {ANNOTATION_TYPE_ICONS[edgeAnnotations.get(edgeKey)[0].annotationType || 'context']}
                    </text>
                  </g>
                )}
                <circle
                  id={`graph-dot-${edge.index}`}
                  r={isHighlighted ? 3 : 2}
                  fill={isHighlighted ? '#7ADB12' : '#666'}
                  opacity={isDimmed ? 0.1 : 0.7}
                  style={{ transition: 'opacity 0.3s ease' }}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodeTypes.map((type) => {
            const pos = positions.get(type);
            if (!pos) return null;

            const isHighlighted = highlightedNodes.has(type);
            const isDimmed = hasSelection && !isHighlighted;
            const nTier = nodeTier.get(type);
            const color = getColor(type);
            const connCount = edges.filter((e) => e.from === type || e.to === type).length;
            const hasAnnotation = showAnnotations && nodeAnnotations.has(type);
            const nodeAnns = nodeAnnotations.get(type) || [];

            // Node size based on tier (anchor nodes slightly larger)
            const nodeRadius = nTier === 0 ? NODE_RADIUS + 3 : NODE_RADIUS;
            const nodeOpacity = isDimmed ? 0.2 : nTier === 2 ? 0.7 : 1;

            return (
              <g
                key={type}
                className={`graph-node ${isDimmed ? 'dimmed' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleNodeClick(type); }}
                style={{ cursor: 'pointer' }}
              >
                {nTier === 0 && (
                  <circle cx={pos.x} cy={pos.y} r={nodeRadius + 4} fill="none" stroke={color} strokeWidth="2" opacity="0.4" filter="url(#node-glow)" />
                )}
                <circle
                  cx={pos.x} cy={pos.y} r={nodeRadius}
                  fill="#1f1d1e"
                  stroke={hasAnnotation && !isDimmed ? ANNOTATION_TYPE_COLORS[nodeAnns[0].annotationType || 'context'] : isDimmed ? '#333' : color}
                  strokeWidth={nTier === 0 ? 2.5 : hasAnnotation ? 2 : isHighlighted ? 1.5 : 1}
                  opacity={nodeOpacity}
                  style={{ transition: 'all 0.3s ease' }}
                />
                {/* Annotation ring pulse */}
                {hasAnnotation && !isDimmed && (
                  <circle
                    cx={pos.x} cy={pos.y} r={NODE_RADIUS + 2}
                    fill="none"
                    stroke={ANNOTATION_TYPE_COLORS[nodeAnns[0].annotationType || 'context']}
                    strokeWidth="1"
                    opacity="0.3"
                    className="annotation-pulse"
                  />
                )}
                <text x={pos.x} y={pos.y - 2} textAnchor="middle" dominantBaseline="central" fontSize="16" opacity={isDimmed ? 0.3 : 1} style={{ transition: 'opacity 0.3s ease' }}>
                  {getIcon(type)}
                </text>
                <text x={pos.x} y={pos.y + NODE_RADIUS + 14} textAnchor="middle" className={`node-label ${isDimmed ? 'dimmed' : ''}`}>
                  {type}
                </text>
                {/* Connection count badge */}
                {connCount > 0 && !isDimmed && (
                  <>
                    <circle cx={pos.x + NODE_RADIUS - 4} cy={pos.y - NODE_RADIUS + 4} r={8} fill={color} opacity="0.9" />
                    <text x={pos.x + NODE_RADIUS - 4} y={pos.y - NODE_RADIUS + 4} textAnchor="middle" dominantBaseline="central" className="conn-badge">{connCount}</text>
                  </>
                )}
                {/* Annotation badge on node */}
                {hasAnnotation && !isDimmed && (
                  <g onClick={(e) => handleAnnotationClick(nodeAnns[0], e)} style={{ cursor: 'pointer' }}>
                    <circle cx={pos.x - NODE_RADIUS + 4} cy={pos.y - NODE_RADIUS + 4} r={9} fill={ANNOTATION_TYPE_COLORS[nodeAnns[0].annotationType || 'context']} opacity="0.95" />
                    <text x={pos.x - NODE_RADIUS + 4} y={pos.y - NODE_RADIUS + 4} textAnchor="middle" dominantBaseline="central" fontSize="10">
                      {ANNOTATION_TYPE_ICONS[nodeAnns[0].annotationType || 'context']}
                    </text>
                    {nodeAnns.length > 1 && (
                      <text x={pos.x - NODE_RADIUS + 14} y={pos.y - NODE_RADIUS - 2} textAnchor="middle" className="annotation-count">+{nodeAnns.length - 1}</text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Relationship Neighborhood Panel (edge click) */}
      <div className={`graph-panel graph-panel-wide ${selectedEdge && !selectedAnnotation ? 'visible' : ''}`}>
        {selectedEdge && !selectedAnnotation && (
          <>
            <div className="graph-panel-header">
              <div className="graph-panel-title">
                <span className="panel-type-icon">{getIcon(selectedEdge.from)}</span>
                <span className="panel-type-name">{selectedEdge.from}</span>
                <span className="panel-arrow">→</span>
                <span className="panel-rel-label">{selectedEdge.label}</span>
                <span className="panel-arrow">→</span>
                <span className="panel-type-icon">{getIcon(selectedEdge.to)}</span>
                <span className="panel-type-name">{selectedEdge.to}</span>
              </div>
              <button className="graph-panel-close" onClick={(e) => { e.stopPropagation(); setSelectedEdge(null); }}>×</button>
            </div>
            <div className="graph-panel-body">
              {/* Upstream section */}
              {upstreamEdges.length > 0 && (
                <div className="neighborhood-section">
                  <div className="neighborhood-title upstream">↑ Upstream</div>
                  {upstreamEdges.map((e, i) => (
                    <div key={i} className={`neighborhood-edge hop-${e.hop}`}>
                      <span className="ne-icon">{getIcon(e.from)}</span>
                      <span className="ne-from">{e.from}</span>
                      <span className="ne-label">{e.label}</span>
                      <span className="ne-arrow">→</span>
                      <span className="ne-icon">{getIcon(e.to)}</span>
                      <span className="ne-to">{e.to}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected edge (highlighted) */}
              <div className="neighborhood-section">
                <div className="neighborhood-title selected">● Selected relationship</div>
                <div className="neighborhood-edge hop-0 selected-edge">
                  <span className="ne-icon">{getIcon(selectedEdge.from)}</span>
                  <span className="ne-from">{selectedEdge.from}</span>
                  <span className="ne-label">{selectedEdge.label}</span>
                  <span className="ne-arrow">→</span>
                  <span className="ne-icon">{getIcon(selectedEdge.to)}</span>
                  <span className="ne-to">{selectedEdge.to}</span>
                </div>
              </div>

              {/* Downstream section */}
              {downstreamEdges.length > 0 && (
                <div className="neighborhood-section">
                  <div className="neighborhood-title downstream">↓ Downstream</div>
                  {downstreamEdges.map((e, i) => (
                    <div key={i} className={`neighborhood-edge hop-${e.hop}`}>
                      <span className="ne-icon">{getIcon(e.from)}</span>
                      <span className="ne-from">{e.from}</span>
                      <span className="ne-label">{e.label}</span>
                      <span className="ne-arrow">→</span>
                      <span className="ne-icon">{getIcon(e.to)}</span>
                      <span className="ne-to">{e.to}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Examples */}
              {selectedEdge.examples?.length > 0 && (
                <div className="neighborhood-section">
                  <div className="neighborhood-title examples">Real examples</div>
                  {selectedEdge.examples.map((ex, i) => (
                    <div key={i} className="example-row">
                      <div className="example-from">
                        <span className="example-icon">{getIcon(selectedEdge.from)}</span>
                        <span className="example-label">{ex.from?.label || '?'}</span>
                      </div>
                      <span className="example-arrow">→</span>
                      <div className="example-to">
                        <span className="example-icon">{getIcon(selectedEdge.to)}</span>
                        <span className="example-label">{ex.to?.label || '?'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {upstreamEdges.length === 0 && downstreamEdges.length === 0 && !selectedEdge.examples?.length && (
                <div className="panel-empty">This is an isolated relationship with no connected paths.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Annotation Panel (annotation click) */}
      <div className={`graph-panel ${selectedAnnotation ? 'visible' : ''}`}>
        {selectedAnnotation && (
          <>
            <div className="graph-panel-header">
              <div className="graph-panel-title">
                <span className="annotation-type-badge" style={{ background: ANNOTATION_TYPE_COLORS[selectedAnnotation.annotationType || 'context'] }}>
                  {ANNOTATION_TYPE_ICONS[selectedAnnotation.annotationType || 'context']} {selectedAnnotation.annotationType || 'context'}
                </span>
                {selectedAnnotation.nodeType && (
                  <span className="panel-type-name">on {selectedAnnotation.nodeType}</span>
                )}
              </div>
              <button className="graph-panel-close" onClick={(e) => { e.stopPropagation(); setSelectedAnnotation(null); }}>×</button>
            </div>
            <div className="graph-panel-body">
              <div className="annotation-panel-text">{selectedAnnotation.text}</div>
              <div className="annotation-panel-meta">
                <span className="annotation-panel-author">{selectedAnnotation.author}</span>
                {selectedAnnotation.createdAt && (
                  <span className="annotation-panel-date">
                    {new Date(selectedAnnotation.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {/* Show all annotations for this target */}
              {(() => {
                const target = selectedAnnotation.nodeType || selectedAnnotation.edgeKey;
                const siblings = annotations.filter((a) => (a.nodeType || a.edgeKey) === target && a.id !== selectedAnnotation.id);
                if (siblings.length === 0) return null;
                return (
                  <>
                    <div className="panel-section-label" style={{ marginTop: 12 }}>Other notes on this {selectedAnnotation.nodeType ? 'object' : 'relationship'}</div>
                    {siblings.map((a) => (
                      <div key={a.id} className="annotation-sibling" onClick={(e) => handleAnnotationClick(a, e)}>
                        <span style={{ color: ANNOTATION_TYPE_COLORS[a.annotationType || 'context'] }}>
                          {ANNOTATION_TYPE_ICONS[a.annotationType || 'context']}
                        </span>
                        <span className="annotation-sibling-text">{a.text}</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Node info tooltip */}
      {hoveredNode && !selectedEdge && !selectedAnnotation && (
        <div className="graph-node-info">
          <span className="node-info-icon">{getIcon(hoveredNode)}</span>
          <span className="node-info-type">{hoveredNode}</span>
          <span className="node-info-count">
            {edges.filter((e) => e.from === hoveredNode || e.to === hoveredNode).length} connections
          </span>
          {nodeAnnotations.has(hoveredNode) && (
            <span className="node-info-annotations">
              · {nodeAnnotations.get(hoveredNode).length} note{nodeAnnotations.get(hoveredNode).length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
