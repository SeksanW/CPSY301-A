import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const TEST_TYPES = ['icp', 'alkalinity', 'ph_conductivity', 'tictoc', 'ic'];

export default function COCDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [coc, setCoc] = useState(null);
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddSample, setShowAddSample] = useState(false);
  const [newSample, setNewSample] = useState({ sample_id: '', sample_type: '', description: '', sample_point: '', matrix: '' });
  const [sampleError, setSampleError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/coc/${id}`),
      api.get(`/samples?coc_id=${id}`)
    ]).then(([cocRes, samplesRes]) => {
      setCoc(cocRes.data);
      setSamples(samplesRes.data);
    }).catch(err => {
      if (err.response?.status === 404) navigate('/coc');
    }).finally(() => setLoading(false));
  }, [id]);

  const loadResults = async (sampleId) => {
    setSelectedSample(sampleId);
    const fetches = TEST_TYPES.map(t =>
      api.get(`/results/${sampleId}/${t}`).then(r => ({ type: t, data: r.data })).catch(() => ({ type: t, data: [] }))
    );
    const all = await Promise.all(fetches);
    const map = {};
    all.forEach(({ type, data }) => { map[type] = data; });
    setResults(map);
  };

  const handleAddSample = async (e) => {
    e.preventDefault();
    setSampleError('');
    if (!newSample.sample_id) return setSampleError('Sample ID is required.');
    try {
      await api.post('/samples', { ...newSample, coc_id: id });
      const res = await api.get(`/samples?coc_id=${id}`);
      setSamples(res.data);
      setShowAddSample(false);
      setNewSample({ sample_id: '', sample_type: '', description: '', sample_point: '', matrix: '' });
    } catch (err) {
      setSampleError(err.response?.data?.message || 'Failed to add sample.');
    }
  };

  const handleDeleteSample = async (sampleId) => {
    if (!confirm(`Delete sample ${sampleId}?`)) return;
    try {
      await api.delete(`/samples/${sampleId}`);
      setSamples(prev => prev.filter(s => s.sample_id !== sampleId));
      if (selectedSample === sampleId) { setSelectedSample(null); setResults({}); }
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  if (loading) return <Layout><p>Loading...</p></Layout>;

  return (
    <Layout>
      <div className="page-header">
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/coc')}>← Back</button>
        <h1>COC: {id}</h1>
      </div>

      <div className="coc-detail-meta card">
        <h2>Details</h2>
        <div className="meta-grid">
          <div><label>Project</label><span>{coc?.project_name || '—'}</span></div>
          <div><label>Report Name</label><span>{coc?.report_name || '—'}</span></div>
          <div><label>Report Email</label><span>{coc?.report_email || '—'}</span></div>
          <div><label>Submitted By</label><span>{coc?.submitted_by || '—'}</span></div>
          <div><label>Status</label><span className={`status-badge status-${coc?.status}`}>{coc?.status}</span></div>
          <div><label>Created</label><span>{coc?.created_at ? new Date(coc.created_at).toLocaleDateString() : '—'}</span></div>
        </div>
        {coc?.notes && <p className="notes"><strong>Notes:</strong> {coc.notes}</p>}
      </div>

      <div className="samples-section card">
        <div className="card-header">
          <h2>Samples ({samples.length})</h2>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddSample(!showAddSample)}>
              {showAddSample ? 'Cancel' : '+ Add Sample'}
            </button>
          )}
        </div>

        {showAddSample && (
          <form onSubmit={handleAddSample} className="add-form">
            <h3>New Sample</h3>
            {sampleError && <div className="alert alert-error">{sampleError}</div>}
            <div className="form-row">
              <div className="form-group">
                <label>Sample ID *</label>
                <input value={newSample.sample_id} onChange={e => setNewSample({ ...newSample, sample_id: e.target.value })} placeholder="e.g. S001" />
              </div>
              <div className="form-group">
                <label>Sample Type</label>
                <input value={newSample.sample_type} onChange={e => setNewSample({ ...newSample, sample_type: e.target.value })} placeholder="e.g. Water, Oil" />
              </div>
              <div className="form-group">
                <label>Sample Point</label>
                <input value={newSample.sample_point} onChange={e => setNewSample({ ...newSample, sample_point: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Matrix</label>
                <input value={newSample.matrix} onChange={e => setNewSample({ ...newSample, matrix: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={newSample.description} onChange={e => setNewSample({ ...newSample, description: e.target.value })} rows={2} />
            </div>
            <button type="submit" className="btn btn-primary">Save Sample</button>
          </form>
        )}

        {samples.length === 0 ? (
          <p className="empty-state">No samples yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Sample ID</th>
                <th>Type</th>
                <th>Sample Point</th>
                <th>Matrix</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {samples.map(s => (
                <tr key={s.sample_id} className={selectedSample === s.sample_id ? 'selected-row' : ''}>
                  <td><strong>{s.sample_id}</strong></td>
                  <td>{s.sample_type || '—'}</td>
                  <td>{s.sample_point || '—'}</td>
                  <td>{s.matrix || '—'}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => loadResults(s.sample_id)}>View Results</button>
                    {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSample(s.sample_id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedSample && (
        <div className="results-section card">
          <h2>Test Results — {selectedSample}</h2>
          {TEST_TYPES.map(t => {
            const rows = results[t] || [];
            if (rows.length === 0) return null;
            return (
              <div key={t} className="result-group">
                <h3>{t.replace('_', '/').toUpperCase()}</h3>
                <table className="table">
                  <thead>
                    <tr>{Object.keys(rows[0]).filter(k => k !== 'sample_id').map(k => <th key={k}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        {Object.entries(row).filter(([k]) => k !== 'sample_id').map(([k, v]) => (
                          <td key={k}>{v ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {TEST_TYPES.every(t => !results[t] || results[t].length === 0) && (
            <p className="empty-state">No test results recorded for this sample.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
