import { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import api from '../api/axios';
import Layout from '../components/Layout';

const TEST_TYPES = ['icp', 'alkalinity', 'ph_conductivity', 'tictoc', 'ic'];

export default function Export() {
  const [cocId, setCocId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cocData, setCocData] = useState(null);
  const [samples, setSamples] = useState([]);
  const [allResults, setAllResults] = useState({});

  const fetchData = async () => {
    if (!cocId.trim()) return setError('Please enter a COC ID.');
    setError(''); setLoading(true); setCocData(null); setSamples([]); setAllResults({});
    try {
      const [cocRes, samplesRes] = await Promise.all([
        api.get(`/coc/${cocId}`),
        api.get(`/samples?coc_id=${cocId}`)
      ]);
      setCocData(cocRes.data);
      const sampleList = samplesRes.data;
      setSamples(sampleList);

      const resultMap = {};
      for (const sample of sampleList) {
        resultMap[sample.sample_id] = {};
        for (const t of TEST_TYPES) {
          try {
            const r = await api.get(`/results/${sample.sample_id}/${t}`);
            if (r.data && r.data.length > 0) resultMap[sample.sample_id][t] = r.data;
          } catch (_) {}
        }
      }
      setAllResults(resultMap);
    } catch (err) {
      setError(err.response?.status === 404 ? 'COC not found.' : 'Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: COC Info
    const cocSheet = XLSX.utils.json_to_sheet([{
      'COC ID': cocData.coc_id,
      'Project Name': cocData.project_name || '',
      'Report Name': cocData.report_name || '',
      'Report Email': cocData.report_email || '',
      'Submitted By': cocData.submitted_by || '',
      'Status': cocData.status || '',
      'Created At': cocData.created_at ? new Date(cocData.created_at).toLocaleDateString() : '',
      'Notes': cocData.notes || '',
    }]);
    XLSX.utils.book_append_sheet(wb, cocSheet, 'COC Info');

    // Sheet 2: Samples
    if (samples.length > 0) {
      const samplesSheet = XLSX.utils.json_to_sheet(samples.map(s => ({
        'Sample ID': s.sample_id,
        'Sample Point': s.sample_point || '',
        'Matrix': s.matrix || '',
        'Time Collected': s.time_collected || '',
        'Date Completed': s.date_time_completed ? new Date(s.date_time_completed).toLocaleDateString() : '',
      })));
      XLSX.utils.book_append_sheet(wb, samplesSheet, 'Samples');
    }

    // One sheet per test type
    const testLabels = { icp: 'ICP', alkalinity: 'Alkalinity', ph_conductivity: 'pH-Conductivity', tictoc: 'TIC-TOC', ic: 'IC' };
    for (const t of TEST_TYPES) {
      const rows = [];
      for (const sampleId of Object.keys(allResults)) {
        const data = allResults[sampleId][t];
        if (data) rows.push(...data.map(r => ({ 'Sample ID': sampleId, ...r })));
      }
      if (rows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), testLabels[t]);
      }
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${cocId}-export.xlsx`);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    const idKeys = ['icp_id', 'alkalinity_id', 'ph_cond_id', 'tictoc_id', 'ic_id'];
    const testLabels = { icp: 'ICP', alkalinity: 'Alkalinity', ph_conductivity: 'pH / Conductivity', tictoc: 'TIC / TOC', ic: 'IC' };

    let html = `
      <html>
      <head>
        <title>COC Report - ${cocId}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #222; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          h2 { font-size: 14px; margin-top: 20px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          h3 { font-size: 12px; margin: 12px 0 4px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
          th { background: #1a1a2e; color: white; padding: 5px 8px; text-align: left; }
          td { padding: 4px 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 12px; }
          .meta div { font-size: 12px; }
          .meta label { font-weight: bold; margin-right: 6px; }
          .footer { margin-top: 32px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
          @media print { body { margin: 12px; } }
        </style>
      </head>
      <body>
        <h1>ARIS LIMS — COC Report</h1>
        <div class="meta">
          <div><label>COC ID:</label>${cocData.coc_id}</div>
          <div><label>Project:</label>${cocData.project_name || '—'}</div>
          <div><label>Submitted By:</label>${cocData.submitted_by || '—'}</div>
          <div><label>Status:</label>${cocData.status || '—'}</div>
          <div><label>Report Name:</label>${cocData.report_name || '—'}</div>
          <div><label>Created:</label>${cocData.created_at ? new Date(cocData.created_at).toLocaleDateString() : '—'}</div>
          ${cocData.notes ? `<div style="grid-column:span 2"><label>Notes:</label>${cocData.notes}</div>` : ''}
        </div>

        <h2>Samples (${samples.length})</h2>
        <table>
          <thead><tr><th>Sample ID</th><th>Sample Point</th><th>Matrix</th><th>Time Collected</th><th>Date Completed</th></tr></thead>
          <tbody>
            ${samples.map(s => `<tr>
              <td>${s.sample_id}</td>
              <td>${s.sample_point || '—'}</td>
              <td>${s.matrix || '—'}</td>
              <td>${s.time_collected || '—'}</td>
              <td>${s.date_time_completed ? new Date(s.date_time_completed).toLocaleDateString() : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
    `;

    for (const t of TEST_TYPES) {
      const rows = [];
      for (const sampleId of Object.keys(allResults)) {
        const data = allResults[sampleId][t];
        if (data) rows.push(...data.map(r => ({ 'Sample ID': sampleId, ...r })));
      }
      if (rows.length === 0) continue;
      const cols = Object.keys(rows[0]).filter(k => !idKeys.includes(k));
      html += `
        <h2>${testLabels[t]} Results</h2>
        <table>
          <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(r => `<tr>${cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      `;
    }

    html += `
        <div class="footer">Generated by ARIS LIMS &mdash; ${new Date().toLocaleString()}</div>
      </body></html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Export & Reports</h1>
      </div>

      <div className="card">
        <h2>Select COC</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>COC ID</label>
            <input
              value={cocId}
              onChange={e => setCocId(e.target.value)}
              placeholder="e.g. COC22001"
              onKeyDown={e => e.key === 'Enter' && fetchData()}
            />
          </div>
          <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Load COC'}
          </button>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: '12px' }}>{error}</div>}
      </div>

      {cocData && (
        <>
          <div className="card">
            <h2>COC: {cocData.coc_id}</h2>
            <div className="meta-grid">
              <div><label>Project</label><span>{cocData.project_name || '—'}</span></div>
              <div><label>Submitted By</label><span>{cocData.submitted_by || '—'}</span></div>
              <div><label>Status</label><span>{cocData.status || '—'}</span></div>
              <div><label>Samples</label><span>{samples.length}</span></div>
            </div>
          </div>

          <div className="card">
            <h2>Export Options</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={exportExcel}>
                Download Excel (.xlsx)
              </button>
              <button className="btn btn-secondary" onClick={printReport}>
                Print / Save as PDF
              </button>
            </div>
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: '#666' }}>
              Excel export includes separate sheets for COC info, samples, and each test type.<br />
              Print opens a formatted report — use your browser's "Save as PDF" option to export as PDF.
            </p>
          </div>
        </>
      )}
    </Layout>
  );
}
