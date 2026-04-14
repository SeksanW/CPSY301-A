import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function getFavourites() {
  try { return JSON.parse(localStorage.getItem('favourites') || '[]'); } catch { return []; }
}
function setFavourites(ids) {
  localStorage.setItem('favourites', JSON.stringify(ids));
}

export default function COCList() {
  const [cocs, setCocs] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [favourites, setFavouritesState] = useState(getFavourites);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

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

  const fetchCOCs = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (date) params.date = date;
    api.get('/coc', { params })
      .then(res => setCocs(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load COCs.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCOCs(); }, []);

  const handleDelete = async (id) => {
    if (!confirm(`Delete COC ${id}? This will also delete all samples and results.`)) return;
    try {
      await api.delete(`/coc/${id}`);
      setCocs(prev => prev.filter(c => c.coc_id !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <Layout>
      <div className="page-header">
        <h1>COC Vault</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>+ Upload COC</button>
        )}
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search by COC ID or project name..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (!e.target.value.trim() && !date) fetchCOCs();
          }}
          className="filter-input"
        />
        <input
          type="date"
          value={date}
          onChange={e => {
            setDate(e.target.value);
            if (!e.target.value && !search.trim()) fetchCOCs();
          }}
          className="filter-input"
        />
        <button className="btn btn-secondary" onClick={() => {
          if (!search.trim() && !date) { alert('Please enter a COC ID or project name to search.'); return; }
          fetchCOCs();
        }}>Search</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : cocs.length === 0 ? (
        <p className="empty-state">No COC records found.</p>
      ) : (
        <div className="coc-list">
          {cocs.map(c => {
            const isOpen = expanded === c.coc_id;
            return (
              <div key={c.coc_id} className={`coc-list-card ${isOpen ? 'coc-list-card-open' : ''}`}>
                {/* Summary row — always visible */}
                <div className="coc-list-summary" onClick={() => toggle(c.coc_id)}>
                  <button className="star-btn" onClick={e => toggleFav(e, c.coc_id)} title="Favourite">
                    {favourites.includes(c.coc_id) ? '★' : '☆'}
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

                {/* Expanded detail */}
                {isOpen && (
                  <div className="coc-list-expanded">
                    <div className="coc-expanded-grid">
                      <div><label>Report Name</label><span>{c.report_name || '—'}</span></div>
                      <div><label>Submitted By</label><span>{c.submitted_by || '—'}</span></div>
                      <div><label>Created</label><span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</span></div>
                      <div><label>Status</label>
                        <button className={`status-toggle status-${c.status}`} onClick={e => toggleStatus(e, c.coc_id, c.status)}>
                          {c.status === 'complete' ? 'Complete' : 'Incomplete'}
                        </button>
                      </div>
                    </div>
                    {c.notes && <p className="coc-expanded-notes"><strong>Notes:</strong> {c.notes}</p>}
                    <div className="coc-expanded-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/coc/${c.coc_id}`)}>View COC</button>
                      {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.coc_id)}>Delete</button>
                      )}
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
