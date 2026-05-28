import { memo, useEffect, useRef, useState } from 'react';
import { useToast } from './Toast.jsx';

function AdminPanel({ slug, data, onAnnotationChange }) {
  const toast = useToast();
  const [shareHours, setShareHours] = useState('24');
  const [shareLinks, setShareLinks] = useState([]);
  const [creatingShare, setCreatingShare] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [annotationTarget, setAnnotationTarget] = useState('');
  const [annotationType, setAnnotationType] = useState('context');
  const [annotationAuthor, setAnnotationAuthor] = useState('');
  const [addingAnnotation, setAddingAnnotation] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchShareLinks(controller.signal);
    return () => controller.abort();
  }, [slug]);

  async function fetchShareLinks(signal) {
    try {
      const res = await fetch(`/api/share?slug=${slug}`, {
        credentials: 'include',
        cache: 'no-store',
        signal,
      });
      if (!mountedRef.current) return;
      if (res.ok) {
        const json = await res.json();
        setShareLinks(json.tokens || []);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  async function createShareLink() {
    setCreatingShare(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slug,
          expiresInHours: parseInt(shareHours, 10),
          createdBy: 'admin',
        }),
      });
      if (res.ok && mountedRef.current) {
        await fetchShareLinks();
      }
    } catch {
      /* ignore */
    } finally {
      if (mountedRef.current) setCreatingShare(false);
    }
  }

  async function revokeShareLink(token) {
    try {
      await fetch('/api/share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, slug }),
      });
      if (mountedRef.current) await fetchShareLinks();
    } catch {
      /* ignore */
    }
  }

  async function addAnnotation(e) {
    e.preventDefault();
    if (!annotationText.trim()) return;
    setAddingAnnotation(true);
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slug,
          text: annotationText.trim(),
          nodeType: annotationTarget || null,
          annotationType,
          author: annotationAuthor || 'DevRev Team',
        }),
      });
      if (res.ok && mountedRef.current) {
        const annotation = await res.json();
        setAnnotationText('');
        setAnnotationTarget('');
        onAnnotationChange?.({ type: 'add', annotation });
      }
    } catch {
      /* ignore */
    } finally {
      if (mountedRef.current) setAddingAnnotation(false);
    }
  }

  async function deleteAnnotation(id) {
    try {
      const res = await fetch('/api/annotations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, slug }),
      });
      if (res.ok && mountedRef.current) onAnnotationChange?.({ type: 'delete', id });
    } catch {
      /* ignore */
    }
  }

  function getShareUrl(token) {
    const base = window.location.origin;
    return `${base}/customer/${slug}?token=${token}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data.model, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-object-model.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON exported');
  }

  function exportSVG() {
    const svg = document.querySelector('.customer-graph-svg');
    if (!svg) return toast.error('No graph to export');
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-relationship-graph.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const nodeTypes = [...new Set(data.model?.relationships?.flatMap((r) => [r.from, r.to]) || [])];

  return (
    <div className="admin-panel">
      <div className="admin-panel-grid">
        <div className="admin-panel-section">
          <div className="admin-panel-section-title">Share links</div>
          <div className="share-create">
            <select
              value={shareHours}
              onChange={(e) => setShareHours(e.target.value)}
              className="share-select"
            >
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </select>
            <button
              type="button"
              className="share-create-btn"
              onClick={createShareLink}
              disabled={creatingShare}
            >
              {creatingShare ? '...' : 'Generate link'}
            </button>
          </div>
          {shareLinks.length > 0 && (
            <div className="share-list">
              {shareLinks.map((s) => (
                <div key={s.token} className="share-item">
                  <div className="share-item-url" onClick={() => copyToClipboard(getShareUrl(s.token))}>
                    {getShareUrl(s.token).slice(0, 50)}...
                    <span className="share-copy-hint">click to copy</span>
                  </div>
                  <div className="share-item-meta">
                    <span>Expires {new Date(s.expiresAt).toLocaleString()}</span>
                    <button type="button" className="share-revoke" onClick={() => revokeShareLink(s.token)}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-panel-section">
          <div className="admin-panel-section-title">Export</div>
          <div className="export-buttons">
            <button type="button" className="export-btn" onClick={exportJSON}>
              📄 JSON
            </button>
            <button type="button" className="export-btn" onClick={exportSVG}>
              🖼 SVG Graph
            </button>
          </div>
        </div>

        <div className="admin-panel-section">
          <div className="admin-panel-section-title">Add annotation</div>
          <form onSubmit={addAnnotation} className="annotation-form">
            <textarea
              className="annotation-input"
              placeholder="Add a note about this org's model..."
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              rows={2}
            />
            <div className="annotation-form-row">
              <select
                value={annotationType}
                onChange={(e) => setAnnotationType(e.target.value)}
                className="share-select"
              >
                <option value="context">💬 Context</option>
                <option value="recommendation">💡 Recommendation</option>
                <option value="question">❓ Question</option>
                <option value="highlight">⭐ Highlight</option>
              </select>
              <select
                value={annotationTarget}
                onChange={(e) => setAnnotationTarget(e.target.value)}
                className="share-select"
              >
                <option value="">Pin to: General</option>
                {nodeTypes.map((t) => (
                  <option key={t} value={t}>Pin to: {t}</option>
                ))}
              </select>
            </div>
            <div className="annotation-form-row">
              <input
                type="text"
                className="annotation-author-input"
                placeholder="Your name"
                value={annotationAuthor}
                onChange={(e) => setAnnotationAuthor(e.target.value)}
              />
              <button type="submit" className="share-create-btn" disabled={addingAnnotation || !annotationText.trim()}>
                Add
              </button>
            </div>
          </form>
          {data.annotations?.length > 0 && (
            <div className="annotation-manage-list">
              {data.annotations.map((a) => (
                <div key={a.id} className="annotation-manage-item">
                  <span className="annotation-manage-text">{a.text}</span>
                  <button type="button" className="share-revoke" onClick={() => deleteAnnotation(a.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AdminPanel);
