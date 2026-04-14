import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

function getFavourites() {
  try { return JSON.parse(localStorage.getItem('favourites') || '[]'); } catch { return []; }
}
function setFavourites(ids) {
  localStorage.setItem('favourites', JSON.stringify(ids));
}

export default function Favourites() {
  const [cocs, setCocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [favourites, setFavouritesState] = useState(getFavourites);
  const navigate = useNavigate();

  useEffect(() => {
    const favIds = getFavourites();
    if (favIds.length === 0) { setLoading(false); return; }
    api.get('/coc')
      .then(res => setCocs(res.data.filter(c => favIds.includes(c.coc_id))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  const toggleFav = (e, id) => {
    e.stopPropagation();
    const current = getFavourites();
    const updated = current.filter(f => f !== id);
    setFavourites(updated);
    setFavouritesState(updated);
    setCocs(prev => prev.filter(c => c.coc_id !== id));
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Favourites</h1>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : cocs.length === 0 ? (
        <div className="card"><p className="empty-state">No favourites saved yet. Click the ☆ on any COC to add it.</p></div>
      ) : (
        <div className="coc-list">
          {cocs.map(c => {
            const isOpen = expanded === c.coc_id;
            const isFav = favourites.includes(c.coc_id);
            return (
              <div key={c.coc_id} className={`coc-list-card ${isOpen ? 'coc-list-card-open' : ''}`}>
                <div className="coc-list-summary" onClick={() => toggle(c.coc_id)}>
                  <button className="star-btn star-filled" onClick={e => toggleFav(e, c.coc_id)} title="Remove from favourites">
                    {isFav ? '★' : '☆'}
                  </button>
                  <span className="coc-id">{c.coc_id}</span>
                  <span className="coc-list-field">{c.project_name || '—'}</span>
                  <span className="coc-list-field">{c.submitted_by || '—'}</span>
                  <span className="coc-list-field">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</span>
                  <span className={`status-badge status-${c.status}`}>{c.status}</span>
                  <span className="coc-chevron">{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="coc-list-expanded">
                    <div className="coc-expanded-grid">
                      <div><label>Report Name</label><span>{c.report_name || '—'}</span></div>
                      <div><label>Submitted By</label><span>{c.submitted_by || '—'}</span></div>
                      <div><label>Created</label><span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</span></div>
                      <div><label>Status</label><span className={`status-badge status-${c.status}`}>{c.status}</span></div>
                    </div>
                    {c.notes && <p className="coc-expanded-notes"><strong>Notes:</strong> {c.notes}</p>}
                    <div className="coc-expanded-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/coc/${c.coc_id}`)}>View COC</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
