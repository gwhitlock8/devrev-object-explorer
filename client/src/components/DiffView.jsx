import { useState } from 'react';

function computeDiff(current, previous) {
  const diff = { added: [], removed: [], changed: [] };

  // Compare categories
  const currentCatIds = new Set(current.categories.map((c) => c.id));
  const prevCatIds = new Set(previous.categories.map((c) => c.id));

  current.categories.forEach((cat) => {
    if (!prevCatIds.has(cat.id)) {
      diff.added.push({ type: 'category', label: cat.label, count: cat.objects.length });
    }
  });

  previous.categories.forEach((cat) => {
    if (!currentCatIds.has(cat.id)) {
      diff.removed.push({ type: 'category', label: cat.label, count: cat.objects.length });
    }
  });

  // Compare relationships
  const currentRels = new Set(current.relationships.map((r) => `${r.from}→${r.to}→${r.label}`));
  const prevRels = new Set(previous.relationships.map((r) => `${r.from}→${r.to}→${r.label}`));

  current.relationships.forEach((r) => {
    const key = `${r.from}→${r.to}→${r.label}`;
    if (!prevRels.has(key)) {
      diff.added.push({ type: 'relationship', label: `${r.from} → ${r.label} → ${r.to}` });
    }
  });

  previous.relationships.forEach((r) => {
    const key = `${r.from}→${r.to}→${r.label}`;
    if (!currentRels.has(key)) {
      diff.removed.push({ type: 'relationship', label: `${r.from} → ${r.label} → ${r.to}` });
    }
  });

  // Compare object counts per category
  current.categories.forEach((cat) => {
    const prevCat = previous.categories.find((c) => c.id === cat.id);
    if (prevCat && cat.objects.length !== prevCat.objects.length) {
      const delta = cat.objects.length - prevCat.objects.length;
      diff.changed.push({
        type: 'count',
        label: cat.label,
        detail: `${delta > 0 ? '+' : ''}${delta} objects (${prevCat.objects.length} → ${cat.objects.length})`,
      });
    }
  });

  return diff;
}

export default function DiffView({ current, snapshots }) {
  const [selectedIdx, setSelectedIdx] = useState(snapshots.length - 1);

  if (!snapshots?.length) return null;

  const snapshot = snapshots[selectedIdx];
  const diff = computeDiff(current, snapshot.model);
  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

  return (
    <div className="diff-view">
      <div className="diff-header">
        <div className="diff-title">Changes since previous discovery</div>
        <div className="diff-selector">
          <span className="diff-label">Compare with:</span>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(parseInt(e.target.value, 10))}
            className="share-select"
          >
            {snapshots.map((s, i) => (
              <option key={i} value={i}>
                {new Date(s.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totalChanges === 0 ? (
        <div className="diff-empty">No changes detected between these snapshots.</div>
      ) : (
        <div className="diff-body">
          <div className="diff-summary">
            <span className="diff-stat diff-added">+{diff.added.length} added</span>
            <span className="diff-stat diff-removed">-{diff.removed.length} removed</span>
            <span className="diff-stat diff-changed">~{diff.changed.length} changed</span>
          </div>

          {diff.added.length > 0 && (
            <div className="diff-section">
              <div className="diff-section-title added">Added</div>
              {diff.added.map((item, i) => (
                <div key={i} className="diff-item added">
                  <span className="diff-item-badge">{item.type}</span>
                  <span className="diff-item-label">{item.label}</span>
                  {item.count && <span className="diff-item-detail">{item.count} objects</span>}
                </div>
              ))}
            </div>
          )}

          {diff.removed.length > 0 && (
            <div className="diff-section">
              <div className="diff-section-title removed">Removed</div>
              {diff.removed.map((item, i) => (
                <div key={i} className="diff-item removed">
                  <span className="diff-item-badge">{item.type}</span>
                  <span className="diff-item-label">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {diff.changed.length > 0 && (
            <div className="diff-section">
              <div className="diff-section-title changed">Changed</div>
              {diff.changed.map((item, i) => (
                <div key={i} className="diff-item changed">
                  <span className="diff-item-badge">{item.type}</span>
                  <span className="diff-item-label">{item.label}</span>
                  <span className="diff-item-detail">{item.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
