import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function Dashboard() {
  const [cocs, setCocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/coc')
      .then(res => setCocs(res.data.slice(0, 5)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total COCs</span>
          <span className="stat-value">{cocs.length}</span>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <h2>Recent COC Activity</h2>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/coc')}>View All</button>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : cocs.length === 0 ? (
          <p className="empty-state">No COC records found. Upload a COC to get started.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>COC ID</th>
                <th>Project Name</th>
                <th>Submitted By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {cocs.map(c => (
                <tr key={c.coc_id} onClick={() => navigate(`/coc/${c.coc_id}`)} className="clickable-row">
                  <td><strong>{c.coc_id}</strong></td>
                  <td>{c.project_name || '—'}</td>
                  <td>{c.submitted_by || '—'}</td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
