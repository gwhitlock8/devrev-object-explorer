import { useCallback, useEffect, useRef, useState } from 'react';
import { categories, meta, displayName } from '../data/objects.js';
import { relationships } from '../data/relationships.js';
import { DevRevLogo } from './common/DevRevLogo.jsx';
import './ObjectExplorer.css';

const FILTERS = [
  { id: 'all', label: 'All', dot: null },
  { id: 'people', label: 'People', dot: 'var(--purple)' },
  { id: 'product', label: 'Product', dot: 'var(--green)' },
  { id: 'work', label: 'Work', dot: 'var(--blue)' },
  { id: 'sales', label: 'Sales', dot: 'var(--orange)' },
  { id: 'support', label: 'Support', dot: 'var(--red)' },
  { id: 'planning', label: 'Planning', dot: 'var(--y400)' },
  { id: 'identity', label: 'Identity', dot: 'var(--n600)' },
  { id: 'collaboration', label: 'Collab', dot: 'var(--cyan)' },
  { id: 'knowledge', label: 'Knowledge', dot: '#A7FF49' },
  { id: 'integrations', label: 'Integrations', dot: '#FFAD76' },
  { id: 'operations', label: 'Operations', dot: '#FF93AC' },
];

function getConnections(id) {
  const c = [];
  relationships.forEach((r) => {
    if (r.from === id) c.push({ target: r.to, label: r.label, direction: 'outgoing' });
    if (r.to === id) c.push({ target: r.from, label: r.label, direction: 'incoming' });
  });
  return c;
}

function connectionCount(id) {
  return relationships.filter((r) => r.from === id || r.to === id).length;
}

export default function ObjectExplorer() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0 });

  const mainRef = useRef(null);
  const svgRef = useRef(null);
  const animRef = useRef(null);
  const nodeRefs = useRef({});

  const panelOpen = selectedNode !== null;
  const connections = selectedNode ? getConnections(selectedNode) : [];
  const connIds = connections.map((c) => c.target);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setNavigationHistory([]);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (svgRef.current) {
      const defs = svgRef.current.querySelector('defs');
      svgRef.current.innerHTML = '';
      if (defs) svgRef.current.appendChild(defs);
    }
  }, []);

  const resizeSVG = useCallback(() => {
    const main = mainRef.current;
    const svg = svgRef.current;
    if (!main || !svg) return;
    svg.setAttribute('width', main.scrollWidth);
    svg.setAttribute('height', main.scrollHeight);
    svg.style.width = `${main.scrollWidth}px`;
    svg.style.height = `${main.scrollHeight}px`;
  }, []);

  const getNodeCenter = useCallback((el) => {
    const main = mainRef.current;
    if (!main || !el) return { x: 0, y: 0 };
    const m = main.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - m.left, y: r.top + r.height / 2 - m.top };
  }, []);

  const drawConnections = useCallback(
    (sourceId, conns) => {
      const svg = svgRef.current;
      if (!svg) return;
      const defs = svg.querySelector('defs');
      svg.innerHTML = '';
      if (defs) svg.appendChild(defs);

      const sourceEl = nodeRefs.current[sourceId];
      if (!sourceEl) return;

      setTimeout(() => {
        const sp = getNodeCenter(sourceEl);
        const paths = [];

        conns.forEach((conn, i) => {
          const te = nodeRefs.current[conn.target];
          if (!te || te.offsetParent === null) return;

          const tp = getNodeCenter(te);
          const dx = tp.x - sp.x;
          const dy = tp.y - sp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const curv = Math.min(dist * 0.18, 40);
          const nx = (-dy / (dist || 1)) * curv * (i % 2 === 0 ? 0.3 : -0.3);
          const ny = (dx / (dist || 1)) * curv * (i % 2 === 0 ? 0.3 : -0.3);
          const cx = (sp.x + tp.x) / 2 + nx;
          const cy = (sp.y + tp.y) / 2 + ny;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M ${sp.x} ${sp.y} Q ${cx} ${cy}, ${tp.x} ${tp.y}`);
          path.setAttribute('stroke', '#7ADB12');
          path.setAttribute('stroke-width', '1.5');
          path.setAttribute('fill', 'none');
          path.style.opacity = '0';
          svg.appendChild(path);

          const len = path.getTotalLength();
          path.style.strokeDasharray = `${len}`;
          path.style.strokeDashoffset = `${len}`;
          requestAnimationFrame(() => {
            path.style.transition = `stroke-dashoffset .5s ease ${i * 0.04}s, opacity .3s ease ${i * 0.03}s`;
            path.style.opacity = '0.55';
            path.style.strokeDashoffset = '0';
          });
          paths.push({ path });
        });

        if (paths.length && animRef.current) cancelAnimationFrame(animRef.current);
        if (paths.length) {
          const dots = paths.map((p, i) => {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', '2');
            dot.setAttribute('fill', '#7ADB12');
            svg.appendChild(dot);
            return { dot, progress: i * 0.12, speed: 0.004 + Math.random() * 0.002, path: p.path };
          });
          const frame = () => {
            dots.forEach((d) => {
              d.progress += d.speed;
              if (d.progress > 1) d.progress = 0;
              try {
                const pt = d.path.getPointAtLength(d.progress * d.path.getTotalLength());
                d.dot.setAttribute('cx', pt.x);
                d.dot.setAttribute('cy', pt.y);
              } catch {
                /* path not ready */
              }
            });
            animRef.current = requestAnimationFrame(frame);
          };
          frame();
        }
      }, 60);
    },
    [getNodeCenter]
  );

  const selectNode = useCallback(
    (nodeId) => {
      if (selectedNode === nodeId) {
        clearSelection();
        return;
      }
      if (animRef.current) cancelAnimationFrame(animRef.current);

      setNavigationHistory((prev) => {
        const idx = prev.indexOf(nodeId);
        if (idx > -1) return prev.slice(0, idx + 1);
        return [...prev, nodeId];
      });
      setSelectedNode(nodeId);

      const conns = getConnections(nodeId);
      setTimeout(() => {
        resizeSVG();
        drawConnections(nodeId, conns);
      }, 80);
    },
    [selectedNode, clearSelection, resizeSVG, drawConnections]
  );

  useEffect(() => {
    resizeSVG();
    const onResize = () => {
      resizeSVG();
      if (selectedNode) drawConnections(selectedNode, getConnections(selectedNode));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeSVG, drawConnections, selectedNode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  const isCategoryVisible = (cat) => {
    if (tierFilter !== 'all' && cat.tier !== tierFilter) return false;
    if (categoryFilter !== 'all' && cat.id !== categoryFilter) return false;
    return true;
  };

  const nodeClass = (id, catId, tier) => {
    const classes = ['object-node'];
    if (meta[id]?.t === 'secondary') classes.push('secondary-node');
    if (selectedNode === id) classes.push('selected');
    else if (selectedNode && connIds.includes(id)) classes.push('connected');
    else if (selectedNode) classes.push('dimmed');
    return classes.join(' ');
  };

  const categoryClass = (cat) => {
    const classes = ['category'];
    if (!isCategoryVisible(cat)) classes.push('hidden');
    if (selectedNode) {
      const nodes = cat.objects;
      const allDimmed = nodes.every((id) => {
        const el = nodeRefs.current[id];
        return selectedNode !== id && !connIds.includes(id);
      });
      if (allDimmed) classes.push('dimmed');
      else classes.push('highlighted');
    }
    return classes.join(' ');
  };

  const selectedMeta = selectedNode ? meta[selectedNode] : null;
  const out = connections.filter((c) => c.direction === 'outgoing');
  const inc = connections.filter((c) => c.direction === 'incoming');

  return (
    <div className="object-explorer">
      <div className={`app-layout ${panelOpen ? 'panel-open' : ''}`}>
        <div className="app-content">
          <header className="header">
            <div className="header-left">
              <DevRevLogo />
              <div className="header-divider" />
              <div className="computer-badge">
                <span className="pulse-dot" />
                Computer
              </div>
            </div>
            <div className="header-stats">
              <span>
                <span className="num">45</span> objects
              </span>
              <span>
                <span className="num">92</span> relationships
              </span>
              <span>
                <span className="num">12</span> categories
              </span>
            </div>
          </header>

          <div className="main" ref={mainRef} onClick={(e) => {
            if (!e.target.closest('.object-node') && !e.target.closest('.detail-panel') && !e.target.closest('.filter-chip') && !e.target.closest('.tier-btn')) {
              clearSelection();
            }
          }}>
            <div className="hero">
              <h1>
                Object <span>Model</span>
              </h1>
              <p>The complete DevRev data model - 45 objects across 12 categories with full relationship mapping</p>
              <div className="hero-hint">
                Click objects to explore <span className="key">ESC</span> to reset
              </div>
            </div>

            <div className="tier-toggle">
              {['all', 'primary', 'secondary'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tier-btn ${tierFilter === t ? 'active' : ''}`}
                  onClick={() => {
                    clearSelection();
                    setTierFilter(t);
                    setCategoryFilter('all');
                  }}
                >
                  {t === 'all' ? 'All objects' : `${t} only`}
                </button>
              ))}
            </div>

            <div className="controls">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-chip ${categoryFilter === f.id ? 'active' : ''}`}
                  onClick={() => {
                    clearSelection();
                    setCategoryFilter(f.id);
                  }}
                >
                  {f.dot && <span className="chip-dot" style={{ background: f.dot }} />}
                  {f.label}
                </button>
              ))}
            </div>

            <svg id="svg-canvas" ref={svgRef}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </svg>

            <div className="grid">
              {categories.map((cat) => (
                <div key={cat.id} className={categoryClass(cat)} data-category={cat.id}>
                  <div className="category-header">
                    <div className="category-header-left">
                      <div className="category-dot" style={{ background: cat.dot }} />
                      <h2>{cat.label}</h2>
                    </div>
                    <span className={`category-tier ${cat.tier}`}>{cat.tier}</span>
                  </div>
                  <div className="objects-list">
                    {cat.objects.map((id) => {
                      const m = meta[id];
                      const count = connectionCount(id);
                      const conn = connections.find((c) => c.target === id);
                      return (
                        <div
                          key={id}
                          ref={(el) => {
                            nodeRefs.current[id] = el;
                          }}
                          className={nodeClass(id, cat.id, m.t)}
                          data-id={id}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectNode(id);
                          }}
                          onMouseEnter={(e) => {
                            if (selectedNode || !count) return;
                            setTooltip({
                              visible: true,
                              text: `${displayName(id)} — ${count} connection${count !== 1 ? 's' : ''}`,
                              x: e.clientX + 12,
                              y: e.clientY - 26,
                            });
                          }}
                          onMouseMove={(e) => {
                            if (!tooltip.visible) return;
                            setTooltip((t) => ({ ...t, x: e.clientX + 12, y: e.clientY - 26 }));
                          }}
                          onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                        >
                          <div className="object-icon">{m.e}</div>
                          <div className="object-details">
                            <div className="object-name">{displayName(id)}</div>
                            <div className="object-desc">{m.d}</div>
                          </div>
                          {count > 0 && <span className="conn-count">{count}</span>}
                          {conn && (
                            <span className="rel-badge">
                              {conn.direction === 'outgoing' ? '→' : '←'} {conn.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`detail-panel ${panelOpen ? 'visible' : ''}`}>
          {selectedMeta && selectedNode && (
            <>
              <div className="detail-panel-header">
                <div className="detail-panel-top">
                  <div className="detail-panel-title">
                    <div className="panel-icon">{selectedMeta.e}</div>
                    <div className="panel-title-text">
                      <h3>{displayName(selectedNode)}</h3>
                      <p>{selectedMeta.d}</p>
                    </div>
                  </div>
                  <button type="button" className="detail-panel-close" onClick={clearSelection}>
                    ×
                  </button>
                </div>
                <div className="panel-meta">
                  <div className="panel-meta-item">
                    <span className="num">{out.length}</span> out
                  </div>
                  <div className="panel-meta-item">
                    <span className="num">{inc.length}</span> in
                  </div>
                  <div className={`panel-meta-item tier-${selectedMeta.t === 'primary' ? 'primary' : 'secondary'}`}>
                    {selectedMeta.t}
                  </div>
                </div>
              </div>
              <div className="detail-body">
                <div className="detail-section-title">About</div>
                <p className="panel-brief-text">{selectedMeta.b}</p>
                {out.length > 0 && (
                  <>
                    <div className="detail-section-title">Outgoing</div>
                    {out.map((conn) => (
                      <div
                        key={`${conn.target}-out`}
                        className="detail-connection"
                        onClick={() => selectNode(conn.target)}
                      >
                        <span>{meta[conn.target].e}</span>
                        <span>{displayName(conn.target)}</span>
                        <span className="dc-direction out">→ OUT</span>
                      </div>
                    ))}
                  </>
                )}
                {inc.length > 0 && (
                  <>
                    <div className="detail-section-title">Incoming</div>
                    {inc.map((conn) => (
                      <div
                        key={`${conn.target}-in`}
                        className="detail-connection"
                        onClick={() => selectNode(conn.target)}
                      >
                        <span>{meta[conn.target].e}</span>
                        <span>{displayName(conn.target)}</span>
                        <span className="dc-direction in">← IN</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="panel-footer">
                {navigationHistory.map((id, i) => (
                  <span key={`${id}-${i}`}>
                    <span
                      className={`breadcrumb-item ${i === navigationHistory.length - 1 ? 'current' : ''}`}
                      onClick={() => selectNode(id)}
                    >
                      {meta[id].e} {displayName(id)}
                    </span>
                    {i < navigationHistory.length - 1 && <span className="breadcrumb-sep"> › </span>}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className={`tooltip ${tooltip.visible ? 'visible' : ''}`}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.text}
      </div>
    </div>
  );
}
