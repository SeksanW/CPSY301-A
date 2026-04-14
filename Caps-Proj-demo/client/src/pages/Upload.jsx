import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function Upload() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('file');
  const [cocId, setCocId] = useState('');
  const [file, setFile] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [reportName, setReportName] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [conflictId, setConflictId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!cocId) return setError('COC ID is required.');
    if (!file) return setError('Please select an Excel file.');
    setError(''); setMessage(''); setConflictId(null); setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('coc_id', cocId);

    try {
      const res = await api.post('/coc/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(res.data.message);
      setTimeout(() => navigate(`/coc/${cocId}`), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
      if (err.response?.status === 409) setConflictId(cocId);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCreate = async (e) => {
    e.preventDefault();
    if (!cocId) return setError('COC ID is required.');
    setError(''); setMessage(''); setConflictId(null); setLoading(true);

    try {
      await api.post('/coc', {
        coc_id: cocId,
        project_name: projectName || null,
        report_name: reportName || null,
        submitted_by: submittedBy || null,
        notes: notes || null,
      });
      setMessage('COC created successfully.');
      setTimeout(() => navigate(`/coc/${cocId}`), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create COC.');
      if (err.response?.status === 409) setConflictId(cocId);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConflict = async () => {
    if (!confirm(`Delete COC ${conflictId} and all its data? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/coc/${conflictId}`);
      setConflictId(null);
      setError('');
      setMessage(`COC ${conflictId} deleted. You can now re-upload.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete COC.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Upload / Create COC</h1>
      </div>

      <div className="tab-bar">
        <button className={`tab ${tab === 'file' ? 'active' : ''}`} onClick={() => setTab('file')}>
          Whole COC Upload (Excel)
        </button>
        <button className={`tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>
          Manual COC Entry
        </button>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span>{error}</span>
          {conflictId && (
            <button className="btn btn-danger btn-sm" onClick={handleDeleteConflict} disabled={deleting}>
              {deleting ? 'Deleting...' : `Delete ${conflictId}`}
            </button>
          )}
        </div>
      )}

      {tab === 'file' && (
        <div className="card">
          <h2>Upload Excel File</h2>
          <p className="hint">The file should have columns: Sample ID, Sample Type, Description</p>
          <form onSubmit={handleFileUpload} className="upload-form">
            <div className="form-group">
              <label>COC ID *</label>
              <input value={cocId} onChange={e => setCocId(e.target.value)} placeholder="e.g. COC-2026-001" />
            </div>
            <div className="form-group">
              <label>Excel File (.xlsx / .xls) *</label>
              <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files[0])} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Uploading...' : 'Upload COC'}
            </button>
          </form>
        </div>
      )}

      {tab === 'manual' && (
        <div className="card">
          <h2>Create COC Manually</h2>
          <form onSubmit={handleManualCreate} className="upload-form">
            <div className="form-group">
              <label>COC ID *</label>
              <input value={cocId} onChange={e => setCocId(e.target.value)} placeholder="e.g. COC-2026-001" />
            </div>
            <div className="form-group">
              <label>Project Name</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Report Name</label>
              <input value={reportName} onChange={e => setReportName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Submitted By</label>
              <input value={submittedBy} onChange={e => setSubmittedBy(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create COC'}
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
}
