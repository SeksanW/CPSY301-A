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

export default function Dashboard() {
  const [cocs, setCocs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [favourites, setFavouritesState] = useState(getFavourites);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/coc').then(res => setCocs(res.data.slice(0, 10))),
      api.get('/activity').then(res => setActivity(res.data)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  const toggleStatus = async (e, id, current) => {
    e.stopPropagation();
    const next = current === 'complete' ? 'incomplete' : 'complete';
    try {
      await api.patch(`/coc/${id}/status`, { status: next });
      setCocs(prev => prev.map(c => c.coc_id === id ? { ...c, status: next } : c));
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const toggleFav = (e, id) => {
    e.stopPropagation();
    const current = getFavourites();
    const updated = current.includes(id) ? current.filter(f => f !== id) : [...current, id];
    setFavourites(updated);
    setFavouritesState(updated);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Dashboard</h1>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/coc')}>View All</button>
      </div>

      <div className="dashboard-body">
        {/* Activity Panel */}
        <div className="activity-panel card">
          <h2 className="activity-title">Activity</h2>
          {loading ? (
            <p style={{ fontSize: '0.82rem', color: '#aaa' }}>Loading...</p>
          ) : activity.length === 0 ? (
            <p className="empty-state">No activity yet.</p>
          ) : (
            <ul className="activity-list">
              {activity.map(a => {
                const icons = { uploaded: '⬆', created: '➕', deleted: '🗑', edited: '✏️' };
                return (
                  <li key={a.activity_id} className="activity-item"
                    onClick={() => a.coc_id && navigate(`/coc/${a.coc_id}`)}
                    style={{ cursor: a.coc_id ? 'pointer' : 'default' }}>
                    <span className="activity-icon">{icons[a.action] || '•'}</span>
                    <div className="activity-info">
                      <span className="activity-coc-id">{a.coc_id || '—'}</span>
                      <span style={{ fontSize: '0.78rem', color: '#666' }}>{a.details}</span>
                      <span className="activity-date">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Expandable COC List */}
        <div>
          {loading ? (
            <p>Loading...</p>
          ) : cocs.length === 0 ? (
            <p className="empty-state">No COC records found.</p>
          ) : (
            <div className="coc-list">
              {cocs.map(c => {
                const isOpen = expanded === c.coc_id;
                const isFav = favourites.includes(c.coc_id);
                return (
                  <div key={c.coc_id} className={`coc-list-card ${isOpen ? 'coc-list-card-open' : ''}`}>
                    <div className="coc-list-summary" onClick={() => toggle(c.coc_id)}>
                      <button className="star-btn" onClick={e => toggleFav(e, c.coc_id)} title="Favourite">
                        {isFav ? '★' : '☆'}
                      </button>
                      <span className="coc-id">{c.coc_id}</span>
                      <span className="coc-list-field">{c.project_name || '—'}</span>
                      <span className="coc-list-field">{c.submitted_by || '—'}</span>
                      <span className="coc-list-field">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</span>
                      <button className={`status-toggle status-${c.status}`} onClick={e => toggleStatus(e, c.coc_id, c.status)}>
                        {c.status === 'complete' ? 'Complete' : 'Incomplete'}
                      </button>
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
        </div>
      </div>
    </Layout>
  );
}
