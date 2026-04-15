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
  const [editingResults, setEditingResults] = useState(false);
  const [editedResults, setEditedResults] = useState({});
  const [customTests, setCustomTests] = useState([]);
  const [showNewTestForm, setShowNewTestForm] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestFields, setNewTestFields] = useState([{ key: '', value: '' }]);
  const [showAddSample, setShowAddSample] = useState(false);
  const [collapsedTests, setCollapsedTests] = useState({});
  const toggleTestCollapse = (key) => setCollapsedTests(prev => ({ ...prev, [key]: !prev[key] }));
  const [newSample, setNewSample] = useState({ sample_id: '', sample_type: '', description: '' });
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

  //loads results for all test types for a sample
  const loadResults = async (sampleId) => {
    setSelectedSample(sampleId);
    setEditingResults(false);
    setEditedResults({});
    setShowNewTestForm(false);
    const fetches = TEST_TYPES.map(t =>
      api.get(`/results/${sampleId}/${t}`).then(r => ({ type: t, data: r.data })).catch(() => ({ type: t, data: [] }))
    );
    const [all, customRes] = await Promise.all([
      Promise.all(fetches),
      api.get(`/custom-tests/${sampleId}`).catch(() => ({ data: [] }))
    ]);
    const map = {};
    all.forEach(({ type, data }) => { map[type] = data; });
    setResults(map);
    setCustomTests(customRes.data || []);
  };

  //edit result triggers a separate state to hold edits in progress, allowing cancel without losing original data
  const startEditing = () => {
    const copy = {};
    TEST_TYPES.forEach(t => { copy[t] = (results[t] || []).map(r => ({ ...r })); });
    setEditedResults(copy);
    setEditingResults(true);
  };

  //the values are held in a cell where any changes wont get saved to the server until the user clicks save, allowing them to edit multiple cells before saving. This function updates the editedResults state as they make changes
  const handleEditCell = (type, rowIdx, key, value) => {
    setEditedResults(prev => {
      const updated = prev[type].map((r, i) => i === rowIdx ? { ...r, [key]: value } : r);
      return { ...prev, [type]: updated };
    });
  };

  const addResultRow = (type) => {
    const existingRows = editedResults[type] || [];
    const fieldKeys = existingRows.length > 0
      ? Object.keys(existingRows[0]).filter(k => k !== 'sample_id')
      : [];
    const blank = { sample_id: selectedSample };
    fieldKeys.forEach(k => { blank[k] = ''; });
    setEditedResults(prev => ({ ...prev, [type]: [...(prev[type] || []), blank] }));
  };

  //when save button is clicked the results are sent over to the server.
  const saveResults = async () => {
    try {
      for (const t of TEST_TYPES) {
        const rows = editedResults[t] || [];
        for (const row of rows) {
          const idKey = t === 'ph_conductivity' ? 'ph_cond_id' : `${t}_id`;
          const resultId = row[idKey];
          if (resultId) {
            await api.put(`/results/${selectedSample}/${t}/${resultId}`, row);
          } else {
            await api.post(`/results/${selectedSample}/${t}`, row);
          }
        }
      }
      setResults(editedResults);
      setEditingResults(false);
      setEditedResults({});
      await api.post('/activity', { action: 'edited', coc_id: id, details: `Updated test results` });
    } catch (err) {
      alert('Failed to save results.');
    }
  };

  const saveNewCustomTest = async () => {
    if (!newTestName.trim()) return alert('Test name is required.');
    const validFields = newTestFields.filter(f => f.key.trim());
    if (validFields.length === 0) return alert('At least one field is required.');
    const fields = {};
    validFields.forEach(f => { fields[f.key.trim()] = f.value; });
    try {
      const res = await api.post(`/custom-tests/${selectedSample}`, { test_name: newTestName, fields });
      setCustomTests(prev => [...prev, { custom_test_id: res.data.custom_test_id, sample_id: selectedSample, test_name: newTestName, fields }]);
      setShowNewTestForm(false);
      setNewTestName('');
      setNewTestFields([{ key: '', value: '' }]);
      await api.post('/activity', { action: 'edited', coc_id: id, details: `Added custom test "${newTestName}"` });
    } catch (err) {
      alert('Failed to save custom test.');
    }
  };

  const deleteCustomTest = async (testId) => {
    if (!confirm('Delete this custom test?')) return;
    try {
      await api.delete(`/custom-tests/${testId}`);
      setCustomTests(prev => prev.filter(t => t.custom_test_id !== testId));
      await api.post('/activity', { action: 'edited', coc_id: id, details: `Deleted custom test` });
    } catch (err) {
      alert('Failed to delete custom test.');
    }
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
      setNewSample({ sample_id: '', sample_type: '', description: '' });
      await api.post('/activity', { action: 'edited', coc_id: id, details: `Added sample "${newSample.sample_id}"` });
    } catch (err) {
      setSampleError(err.response?.data?.message || 'Failed to add sample.');
    }
  };

  const toggleStatus = async () => {
    const next = coc.status === 'complete' ? 'incomplete' : 'complete';
    try {
      await api.patch(`/coc/${id}/status`, { status: next });
      setCoc(prev => ({ ...prev, status: next }));
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleDeleteSample = async (sampleId) => {
    if (!confirm(`Delete sample ${sampleId}?`)) return;
    try {
      await api.delete(`/samples/${sampleId}`);
      setSamples(prev => prev.filter(s => s.sample_id !== sampleId));
      if (selectedSample === sampleId) { setSelectedSample(null); setResults({}); setCustomTests([]); }
      await api.post('/activity', { action: 'edited', coc_id: id, details: `Deleted sample "${sampleId}"` });
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
          <div><label>Status</label>
            <button className={`status-toggle status-${coc?.status}`} onClick={toggleStatus}>
              {coc?.status === 'complete' ? 'Complete' : 'Incomplete'}
            </button>
          </div>
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
                    {isAdmin && <button className="btn btn-danger btn-sm" style={{ marginLeft: '8px' }} onClick={() => handleDeleteSample(s.sample_id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      //Button triggers for editing results, adding custom test types, and collapsing test groups for easier navigation of long result sets
      {selectedSample && (
        <div className="results-section card">
          <div className="card-header">
            <h2>Test Results — {selectedSample}</h2>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {!editingResults && (
                  <button className="btn btn-outline btn-sm" onClick={startEditing}>Edit Results</button>
                )}
                {editingResults && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={saveResults}>Save</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditingResults(false)}>Cancel</button>
                  </>
                )}
                {!showNewTestForm && (
                  <button className="btn btn-outline btn-sm" onClick={() => setShowNewTestForm(true)}>+ Add Test Type</button>
                )}
              </div>
            )}
          </div>

          {/* New custom test form - inline at top */}
          {isAdmin && showNewTestForm && (
            <div className="add-form" style={{ marginBottom: '16px' }}>
              <h3>New Test Type</h3>
              <div className="form-group">
                <label>Test Name *</label>
                <input value={newTestName} onChange={e => setNewTestName(e.target.value)} placeholder="e.g. Crib Test" />
              </div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#444' }}>Fields</label>
              {newTestFields.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                  <input
                    placeholder="Field name"
                    value={f.key}
                    onChange={e => setNewTestFields(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.88rem' }}
                  />
                  <input
                    placeholder="Value"
                    value={f.value}
                    onChange={e => setNewTestFields(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.88rem' }}
                  />
                  {newTestFields.length > 1 && (
                    <button className="btn btn-danger btn-sm" onClick={() => setNewTestFields(prev => prev.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn btn-outline btn-sm" style={{ marginTop: '8px' }}
                onClick={() => setNewTestFields(prev => [...prev, { key: '', value: '' }])}>+ Add Field</button>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button className="btn btn-primary btn-sm" onClick={saveNewCustomTest}>Save</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setShowNewTestForm(false); setNewTestName(''); setNewTestFields([{ key: '', value: '' }]); }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Standard test types */}
          {TEST_TYPES.map(t => {
            const rows = editingResults ? (editedResults[t] || []) : (results[t] || []);
            if (rows.length === 0) return null;
            const idKeys = ['icp_id', 'alkalinity_id', 'ph_cond_id', 'tictoc_id', 'ic_id'];
            const displayKeys = Object.keys(rows[0]).filter(k => k !== 'sample_id' && !idKeys.includes(k));
            const isCollapsed = collapsedTests[t];
            return (
              <div key={t} className="result-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', cursor: 'pointer' }}
                  onClick={() => toggleTestCollapse(t)}>
                  <h3 style={{ margin: 0 }}>{t.replace(/_/g, '/').toUpperCase()}</h3>
                  <span style={{ fontSize: '0.82rem', color: '#666' }}>{isCollapsed ? '▼ Show' : '▲ Hide'}</span>
                </div>
                {!isCollapsed && (
                  <>
                    <table className="table">
                      <thead>
                        <tr>{displayKeys.map(k => <th key={k}>{k}</th>)}</tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i}>
                            {displayKeys.map(k => (
                              <td key={k}>
                                {editingResults ? (
                                  <input type="number" step="any" value={row[k] ?? ''}
                                    onChange={e => handleEditCell(t, i, k, e.target.value)}
                                    style={{ width: '90px', padding: '2px 4px', fontSize: '0.82rem', border: '1px solid #ddd', borderRadius: '4px' }}
                                  />
                                ) : (row[k] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {editingResults && (
                      <button className="btn btn-outline btn-sm" style={{ marginTop: '8px' }} onClick={() => addResultRow(t)}>+ Add Row</button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Custom test types */}
          {customTests.map(ct => {
            const isCollapsed = collapsedTests[`custom_${ct.custom_test_id}`];
            return (
              <div key={ct.custom_test_id} className="result-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', cursor: 'pointer' }}
                  onClick={() => toggleTestCollapse(`custom_${ct.custom_test_id}`)}>
                  <h3 style={{ margin: 0, color: '#1a1a2e' }}>{ct.test_name}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: '#666' }}>{isCollapsed ? '▼ Show' : '▲ Hide'}</span>
                    {isAdmin && <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); deleteCustomTest(ct.custom_test_id); }}>Delete</button>}
                  </div>
                </div>
                {!isCollapsed && (
                  <table className="table">
                    <thead>
                      <tr>{Object.keys(ct.fields).map(k => <th key={k}>{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr>{Object.values(ct.fields).map((v, i) => <td key={i}>{v ?? '—'}</td>)}</tr>
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {TEST_TYPES.every(t => !results[t] || results[t].length === 0) && customTests.length === 0 && (
            <p className="empty-state">No test results recorded for this sample.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
