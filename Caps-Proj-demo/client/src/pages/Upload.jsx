import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function Upload() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('file'); // 'file' | 'manual'
  const [cocId, setCocId] = useState('');
  const [file, setFile] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!cocId) return setError('COC ID is required.');
    if (!file) return setError('Please select an Excel file.');
    setError(''); setMessage(''); setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  const handleManualCreate = async (e) => {
    e.preventDefault();
    if (!cocId) return setError('COC ID is required.');
    setError(''); setMessage(''); setLoading(true);

    try {
      await api.post('/coc', { coc_id: cocId, project_name: projectName, report_email: reportEmail, notes });
      setMessage('COC created successfully.');
      setTimeout(() => navigate(`/coc/${cocId}`), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create COC.');
    } finally {
      setLoading(false);
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
      {error && <div className="alert alert-error">{error}</div>}

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
              <label>Report Email</label>
              <input type="email" value={reportEmail} onChange={e => setReportEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
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
