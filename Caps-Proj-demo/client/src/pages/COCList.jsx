import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export default function COCList() {
  const [cocs, setCocs] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

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
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

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
          onChange={e => setSearch(e.target.value)}
          className="filter-input"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="filter-input"
        />
        <button className="btn btn-secondary" onClick={fetchCOCs}>Search</button>
        <button className="btn btn-outline" onClick={() => { setSearch(''); setDate(''); setTimeout(fetchCOCs, 0); }}>Clear</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : cocs.length === 0 ? (
        <p className="empty-state">No COC records found.</p>
      ) : (
        <div className="coc-grid">
          {cocs.map(c => (
            <div key={c.coc_id} className="coc-card">
              <div className="coc-card-header">
                <span className="coc-id">{c.coc_id}</span>
                <span className={`status-badge status-${c.status}`}>{c.status}</span>
              </div>
              <div className="coc-card-body">
                <p><strong>Project:</strong> {c.project_name || '—'}</p>
                <p><strong>Submitted by:</strong> {c.submitted_by || '—'}</p>
                <p><strong>Date:</strong> {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</p>
              </div>
              <div className="coc-card-actions">
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/coc/${c.coc_id}`)}>View</button>
                {isAdmin && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.coc_id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
