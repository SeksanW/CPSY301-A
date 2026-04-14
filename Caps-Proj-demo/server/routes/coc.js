const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const pool = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('./activity');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage, fileFilter: (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') cb(null, true);
  else cb(new Error('Only Excel files are allowed.'));
}});

// GET /api/coc  — list all COCs (with optional search/filter)
router.get('/', authenticateToken, async (req, res) => {
  const { search, date } = req.query;
  let query = 'SELECT * FROM coc_doc WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (coc_id LIKE ? OR project_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (date) {
    query += ' AND DATE(created_at) = ?';
    params.push(date);
  }
  query += ' ORDER BY created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/coc/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM coc_doc WHERE coc_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'COC not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/coc  — create COC manually (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { coc_id, project_name, report_name, report_email, submitted_by, notes } = req.body;
  if (!coc_id) return res.status(400).json({ message: 'COC ID is required.' });

  try {
    const [existing] = await pool.query('SELECT coc_id FROM coc_doc WHERE coc_id = ?', [coc_id]);
    if (existing.length > 0) return res.status(409).json({ message: 'COC ID already exists.' });

    await pool.query(
      'INSERT INTO coc_doc (coc_id, project_name, report_name, report_email, submitted_by, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [coc_id, project_name || null, report_name || null, report_email || null, submitted_by || null, notes || null]
    );
    await logActivity('created', coc_id, req.user.username, `Manually created COC ${coc_id}`);
    res.status(201).json({ message: 'COC created successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// Helper: find sheet by keyword (case-insensitive)
// Tries exact match first, then startsWith, then includes — avoids 'ic' matching 'ICP'
function findSheet(workbook, keyword) {
  const kw = keyword.toLowerCase();
  let name = workbook.SheetNames.find(n => n.toLowerCase() === kw);
  if (!name) name = workbook.SheetNames.find(n => n.toLowerCase().startsWith(kw));
  if (!name) name = workbook.SheetNames.find(n => n.toLowerCase().includes(kw));
  return name ? workbook.Sheets[name] : null;
}

// Helper: find row index containing a keyword in any cell
function findHeaderRow(rows, keyword) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(cell => cell && String(cell).toLowerCase().includes(keyword.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}


// POST /api/coc/upload  — upload Excel file (admin)
router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  const { coc_id } = req.body;
  if (!coc_id) return res.status(400).json({ message: 'COC ID is required.' });

  //error for existing COC
  try {
    const [existing] = await pool.query('SELECT coc_id FROM coc_doc WHERE coc_id = ?', [coc_id]);
    if (existing.length > 0) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ message: 'COC already exists. Delete or edit the existing one.' });
    }

    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    console.log('📄 Sheet names:', workbook.SheetNames);
    let projectName = null;
    let sampleCount = 0;
    const stats = {};

    // ── Insert COC record first (samples need it for foreign key) ────────
    await pool.query(
      'INSERT INTO coc_doc (coc_id, project_name, file_path, submitted_by) VALUES (?, ?, ?, ?)',
      [coc_id, null, req.file.filename, req.user.username]
    );

    // ── Parse COC sheet for project name and sample IDs ─────────────────────────────────
    const cocSheet = findSheet(workbook, 'coc');
    if (cocSheet) {
      const rows = XLSX.utils.sheet_to_json(cocSheet, { header: 1, defval: null });

      // Extract project name 
      for (const row of rows) {
        const idx = row.findIndex(c => c && String(c).toLowerCase().trim() === 'project:' || c && String(c).toLowerCase().trim() === 'project');
        if (idx !== -1) {
          const adjacent = row[idx + 1];
          if (adjacent && String(adjacent).trim() !== '') {
            projectName = String(adjacent).trim();
          }
          break;
        }
      }

      // Find sample table header row (contains "Sample ID")
      const headerIdx = findHeaderRow(rows, 'sample id');
      if (headerIdx !== -1) {
        const header = rows[headerIdx].map(c => c ? String(c).toLowerCase().trim() : '');
        const sampleIdCol = header.findIndex(h => h.includes('sample id') || h === 'sample id');
        const dateCol     = header.findIndex(h => h.includes('date'));
        const timeCol     = header.findIndex(h => h.includes('time'));
        const pointCol    = header.findIndex(h => h.includes('sampling point') || h.includes('point'));
        const matrixCol   = header.findIndex(h => h.includes('matrix'));

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[sampleIdCol]) continue;
          const sampleId = String(row[sampleIdCol]).trim();
          if (!sampleId) continue;
          if (sampleId.toLowerCase().includes('total') || sampleId.toLowerCase().includes('bottle')) continue;

          const rawDate = dateCol !== -1 ? row[dateCol] : null;
          const dateVal = rawDate instanceof Date ? rawDate : (rawDate ? new Date(rawDate) : null);
          const timeVal = timeCol !== -1 && row[timeCol] ? String(row[timeCol]).trim() : null;
          const point   = pointCol !== -1 ? (row[pointCol] ? String(row[pointCol]).trim() : null) : null;
          const matrix  = matrixCol !== -1 ? (row[matrixCol] ? String(row[matrixCol]).trim() : null) : null;

          await pool.query(
            'INSERT IGNORE INTO samples (sample_id, coc_id, sample_point, time_collected, matrix, date_time_completed) VALUES (?, ?, ?, ?, ?, ?)',
            [sampleId, coc_id, point, timeVal, matrix, dateVal && !isNaN(dateVal) ? dateVal : null]
          );
          sampleCount++;
        }
      }
    }

    // ── Collect sample IDs from result sheets (handles complex COC form layouts) ──
    {
      const resultSheetKeys = ['icp', 'tic', 'ic', 'alk', 'ph'];
      const seenIds = new Set();
      for (const key of resultSheetKeys) {
        const sheet = findSheet(workbook, key);
        console.log(`🔍 Looking for sheet "${key}":`, sheet ? 'found' : 'not found');
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        const headerIdx = findHeaderRow(rows, 'sample');
        console.log(`  Header row index:`, headerIdx);
        if (headerIdx === -1) continue;
        const header = rows[headerIdx].map(c => c ? String(c).toLowerCase().replace(/[\r\n\s]+/g, ' ').trim() : '');
        console.log(`  Header:`, header);
        const sampleCol = header.findIndex(h => h.includes('sample'));
        console.log(`  Sample col index:`, sampleCol);
        if (sampleCol === -1) continue;
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const val = rows[i][sampleCol];
          if (!val) continue;
          const id = String(val).trim();
          if (!id || seenIds.has(id)) continue;
          if (id.toLowerCase().includes('total') || id.toLowerCase().includes('bottle')) continue;
          if (id.toLowerCase() === 'sample id' || id.toLowerCase() === 'sample') continue;
          seenIds.add(id);
          await pool.query('INSERT IGNORE INTO samples (sample_id, coc_id) VALUES (?, ?)', [id, coc_id]);
          sampleCount++;
        }
        console.log(`  Samples collected so far:`, seenIds.size);
      }
    }

    // Update project name now that we've parsed the COC sheet
    if (projectName) {
      await pool.query('UPDATE coc_doc SET project_name = ? WHERE coc_id = ?', [projectName, coc_id]);
    }
    await logActivity('uploaded', coc_id, req.user.username, `Uploaded Excel file for COC ${coc_id}`);

    // ── Parse ICP sheet ───────────────────────────────────────────────────
    const icpSheet = findSheet(workbook, 'icp');
    if (icpSheet) {
      try {
        const rows = XLSX.utils.sheet_to_json(icpSheet, { header: 1, defval: null });
        const headerIdx = findHeaderRow(rows, 'sample id');
        if (headerIdx !== -1) {
          const header = rows[headerIdx].map(c => c ? String(c).toLowerCase().trim() : '');
          const sampleCol = header.findIndex(h => h.includes('sample id'));
          const colMap = [
            ['li tm','li_tm'],['li dm','li_dm'],['be tm','be_tm'],['be dm','be_dm'],
            ['mg tm','mg_tm'],['mg dm','mg_dm'],['al tm','al_tm'],['al dm','al_dm'],
            ['p tm','p_tm'],  ['p dm','p_dm'],  ['ca tm','ca_tm'],['ca dm','ca_dm'],
            ['ti tm','ti_tm'],['ti dm','ti_dm'],['v tm','v_tm'],  ['v dm','v_dm'],
            ['cr tm','cr_tm'],['cr dm','cr_dm'],['mn tm','mn_tm'],['mn dm','mn_dm'],
            ['fe tm','fe_tm'],['fe dm','fe_dm'],['co tm','co_tm'],['co dm','co_dm'],
            ['ni tm','ni_tm'],['ni dm','ni_dm'],['cu tm','cu_tm'],['cu dm','cu_dm'],
            ['zn tm','zn_tm'],['zn dm','zn_dm'],['as tm','as_tm'],['as dm','as_dm'],
            ['se tm','se_tm'],['se dm','se_dm'],['sr tm','sr_tm'],['sr dm','sr_dm'],
            ['mo tm','mo_tm'],['mo dm','mo_dm'],['cd tm','cd_tm'],['cd dm','cd_dm'],
            ['sb tm','sb_tm'],['sb dm','sb_dm'],['ba tm','ba_tm'],['ba dm','ba_dm'],
            ['tl tm','tl_tm'],['tl dm','tl_dm'],['pb tm','pb_tm'],['pb dm','pb_dm'],
            ['u tm','u_tm'],  ['u dm','u_dm'],  ['ag tm','ag_tm'],['ag dm','ag_dm'],
            ['b tm','b_tm'],  ['b dm','b_dm'],  ['na tm','na_tm'],['na dm','na_dm'],
            ['si tm','si_tm'],['si dm','si_dm'],['s tm','s_tm'],  ['s dm','s_dm'],
            ['k tm','k_tm'],  ['k dm','k_dm'],
          ];
          const resolved = colMap.map(([excelName, dbCol]) => ({
            dbCol,
            idx: header.findIndex(h => h === excelName),
          }));
          const numVal = (v) => (v === null || v === undefined || String(v).trim().startsWith('>') || String(v).trim().startsWith('<')) ? null : parseFloat(v);
          let count = 0;
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[sampleCol]) continue;
            const sampleId = String(row[sampleCol]).trim();
            if (sampleId.toLowerCase().includes('total')) continue;
            const cols = resolved.map(c => c.dbCol).join(', ');
            const vals = resolved.map(c => numVal(c.idx !== -1 ? row[c.idx] : null));
            await pool.query(
              `INSERT IGNORE INTO icp (sample_id, ${cols}) VALUES (?, ${vals.map(() => '?').join(', ')})`,
              [sampleId, ...vals]
            );
            count++;
          }
          stats.icp = count;
        }
      } catch (e) { console.error('ICP parse error:', e.message); stats.icp_error = e.message; }
    }

    // ── Parse TICTOC sheet ────────────────────────────────────────────────
    const tictocSheet = findSheet(workbook, 'tic');
    if (tictocSheet) {
      try {
        const rows = XLSX.utils.sheet_to_json(tictocSheet, { header: 1, defval: null });
        const headerIdx = findHeaderRow(rows, 'sample');
        if (headerIdx !== -1) {
          const h = rows[headerIdx].map(c => c ? String(c).toLowerCase().replace(/[\r\n\s]+/g, ' ').trim() : '');
          const sampleCol   = h.findIndex(x => x.includes('sample'));
          const ticResCol   = h.findIndex(x => x.includes('tic') && x.includes('result') && !x.includes('final') && !x.includes('toc'));
          const ticFinalCol = h.findIndex(x => x.includes('tic') && x.includes('final'));
          const ticCaco3Col = h.findIndex(x => x.includes('tic') && x.includes('caco'));
          const tocResCol   = h.findIndex(x => x.includes('toc') && x.includes('result') && !x.includes('final'));
          const tocFinalCol = h.findIndex(x => x.includes('toc') && x.includes('final'));
          const tocCaco3Col = h.findIndex(x => x.includes('toc') && x.includes('caco'));
          let count = 0;
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[sampleCol]) continue;
            await pool.query(
              'INSERT IGNORE INTO tictoc (sample_id, tic_result_ppm, tic_final_result_ppm, tic_as_caco3, toc_result_ppm, toc_final_result_ppm, toc_as_caco3) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [String(row[sampleCol]).trim(),
                ticResCol !== -1 ? row[ticResCol] : null, ticFinalCol !== -1 ? row[ticFinalCol] : null, ticCaco3Col !== -1 ? row[ticCaco3Col] : null,
                tocResCol !== -1 ? row[tocResCol] : null, tocFinalCol !== -1 ? row[tocFinalCol] : null, tocCaco3Col !== -1 ? row[tocCaco3Col] : null]
            );
            count++;
          }
          stats.tictoc = count;
        }
      } catch (e) { console.error('TICTOC parse error:', e.message); stats.tictoc_error = e.message; }
    }

    // ── Parse IC sheet ────────────────────────────────────────────────────
    const icSheet = findSheet(workbook, 'ic');
    if (icSheet) {
      try {
        const rows = XLSX.utils.sheet_to_json(icSheet, { header: 1, defval: null });
        const headerIdx = findHeaderRow(rows, 'sample');
        if (headerIdx !== -1) {
          const h = rows[headerIdx].map(c => c ? String(c).toLowerCase().replace(/[\r\n\s]+/g, ' ').trim() : '');
          const sampleCol = h.findIndex(x => x.includes('sample'));
          const numVal = (v) => (v === null || v === undefined || String(v).trim().startsWith('>') || String(v).trim().startsWith('<')) ? null : parseFloat(v);
          const fCol   = h.findIndex(x => x.startsWith('f ') || x === 'f' || x === 'fluoride');
          const clCol  = h.findIndex(x => x.startsWith('cl ') || x === 'cl' || x === 'chloride');
          const no2Col = h.findIndex(x => x.includes('no2') || x === 'nitrite');
          const brCol  = h.findIndex(x => x.startsWith('br ') || x === 'br' || x === 'bromide');
          const no3Col = h.findIndex(x => x.includes('no3') || x === 'nitrate');
          const so4Col = h.findIndex(x => x.includes('so4') || x === 'sulphate' || x === 'sulfate');
          const po4Col = h.findIndex(x => x.includes('po4') || x === 'phosphate');
          let count = 0;
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[sampleCol]) continue;
            const sid = String(row[sampleCol]).trim();
            if (!sid) continue;
            await pool.query(
              'INSERT IGNORE INTO ic (sample_id, f_ppm, cl_ppm, no2_ppm, br_ppm, no3_ppm, so4_ppm, po4_ppm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [sid,
                numVal(fCol !== -1 ? row[fCol] : null), numVal(clCol !== -1 ? row[clCol] : null),
                numVal(no2Col !== -1 ? row[no2Col] : null), numVal(brCol !== -1 ? row[brCol] : null),
                numVal(no3Col !== -1 ? row[no3Col] : null), numVal(so4Col !== -1 ? row[so4Col] : null),
                numVal(po4Col !== -1 ? row[po4Col] : null)]
            );
            count++;
          }
          stats.ic = count;

          // ── Detect additional tables in IC sheet (e.g. organic acids) ────
          for (let t = headerIdx + 1; t < rows.length; t++) {
            const potentialHeader = rows[t];
            if (!potentialHeader) continue;
            const norm = potentialHeader.map(c => c ? String(c).toLowerCase().replace(/[\r\n\s]+/g, ' ').trim() : '');
            const newSampleCol = norm.findIndex(x => x === 'sample id');
            if (newSampleCol === -1) continue;
            const otherHeaders = norm.filter((x, i) => i !== newSampleCol && x);
            if (otherHeaders.length < 2) continue;
            const testName = 'Organic Acids';
            const extraHeaders = norm.filter((x, i) => i > newSampleCol && x);
            for (let r = t + 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row || !row[newSampleCol]) continue;
              const sid = String(row[newSampleCol]).trim();
              if (!sid || sid.toLowerCase() === 'sample id') continue;
              await pool.query('INSERT IGNORE INTO samples (sample_id, coc_id) VALUES (?, ?)', [sid, coc_id]);
              const fields = {};
              extraHeaders.forEach((hdr, idx) => {
                const val = row[newSampleCol + 1 + idx];
                fields[hdr] = (val === null || String(val).startsWith('<') || String(val).startsWith('>')) ? null : val;
              });
              await pool.query(
                'INSERT INTO custom_tests (sample_id, test_name, fields) VALUES (?, ?, ?)',
                [sid, testName, JSON.stringify(fields)]
              );
            }
            break;
          }
        }
      } catch (e) { console.error('IC parse error:', e.message); stats.ic_error = e.message; }
    }

    // ── Parse Alkalinity sheet ────────────────────────────────────────────
    const alkSheet = findSheet(workbook, 'alk');
    if (alkSheet) {
      try {
        const rows = XLSX.utils.sheet_to_json(alkSheet, { header: 1, defval: null });
        const headerIdx = findHeaderRow(rows, 'sample');
        if (headerIdx !== -1) {
          const h = rows[headerIdx].map(c => c ? String(c).toLowerCase().replace(/[\r\n\s]+/g, ' ').trim() : '');
          const sampleCol     = h.findIndex(x => x.includes('sample'));
          const pAlkCol       = h.findIndex(x => x.startsWith('p ') && x.includes('alk'));
          const tAlkCol       = h.findIndex(x => x.startsWith('t ') && x.includes('alk'));
          const ohPpmCol      = h.findIndex(x => x.includes('hydroxide') && (x.includes('caco3') || x.includes('ppm')));
          const carbPpmCol    = h.findIndex(x => x.includes('carbonate') && !x.includes('bi') && (x.includes('caco3') || x.includes('ppm')) && !x.includes('mg/l'));
          const bicarbPpmCol  = h.findIndex(x => x.includes('bicarb') && (x.includes('caco3') || x.includes('ppm')) && !x.includes('mg/l'));
          const carbMglCol    = h.findIndex(x => x.includes('carbonate') && x.includes('co3') && x.includes('mg'));
          const bicarbMglCol  = h.findIndex(x => x.includes('bicarb') && x.includes('hco3') && x.includes('mg'));
          const ohMglCol      = h.findIndex(x => x.includes('hydroxide') && x.includes('oh') && x.includes('mg'));
          let count = 0;
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[sampleCol]) continue;
            await pool.query(
              'INSERT IGNORE INTO alkalinity (sample_id, p_alk_ppm, t_alk_ppm, hydroxide_ppm, carbonate_ppm, bicarb_ppm, carb_as_co3_mgl, bicarb_as_hco3_mgl, hydroxide_as_oh_mgl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [String(row[sampleCol]).trim(),
                pAlkCol !== -1 ? row[pAlkCol] : null, tAlkCol !== -1 ? row[tAlkCol] : null,
                ohPpmCol !== -1 ? row[ohPpmCol] : null, carbPpmCol !== -1 ? row[carbPpmCol] : null,
                bicarbPpmCol !== -1 ? row[bicarbPpmCol] : null, carbMglCol !== -1 ? row[carbMglCol] : null,
                bicarbMglCol !== -1 ? row[bicarbMglCol] : null, ohMglCol !== -1 ? row[ohMglCol] : null]
            );
            count++;
          }
          stats.alkalinity = count;
        }
      } catch (e) { console.error('Alkalinity parse error:', e.message); stats.alkalinity_error = e.message; }
    }

    // ── Parse pH-Conductivity sheet ───────────────────────────────────────
    const phSheet = findSheet(workbook, 'ph');
    if (phSheet) {
      try {
        const rows = XLSX.utils.sheet_to_json(phSheet, { header: 1, defval: null });
        const headerIdx = findHeaderRow(rows, 'sample');
        if (headerIdx !== -1) {
          const h = rows[headerIdx].map(c => c ? String(c).toLowerCase().replace(/[\r\n\s]+/g, ' ').trim() : '');
          const sampleCol = h.findIndex(x => x.includes('sample'));
          const phCol     = h.findIndex(x => x === 'ph' || x.startsWith('ph '));
          const tempCol   = h.findIndex(x => x.includes('temp'));
          const condCol   = h.findIndex(x => x.includes('conduct'));
          let count = 0;
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[sampleCol]) continue;
            await pool.query(
              'INSERT IGNORE INTO ph_conductivity (sample_id, ph, temperature, conductivity) VALUES (?, ?, ?, ?)',
              [String(row[sampleCol]).trim(),
                phCol !== -1 ? row[phCol] : null, tempCol !== -1 ? row[tempCol] : null,
                condCol !== -1 ? row[condCol] : null]
            );
            count++;
          }
          stats.ph_conductivity = count;
        }
      } catch (e) { console.error('pH parse error:', e.message); stats.ph_error = e.message; }
    }

    res.status(201).json({
      message: 'COC uploaded and parsed successfully.',
      samples: sampleCount,
      results: stats,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'File processing error.', error: err.message });
  }
});

// PATCH /api/coc/:id/status  — toggle status (admin)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['complete', 'incomplete'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
  try {
    await pool.query('UPDATE coc_doc SET status = ? WHERE coc_id = ?', [status, req.params.id]);
    await logActivity('edited', req.params.id, req.user.username, `Status changed to "${status}"`);
    res.json({ message: 'Status updated.', status });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/coc/:id  (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT file_path FROM coc_doc WHERE coc_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'COC not found.' });

    if (rows[0].file_path) {
      const filePath = path.join(__dirname, '../uploads', rows[0].file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM coc_doc WHERE coc_id = ?', [req.params.id]);
    await logActivity('deleted', req.params.id, req.user.username, `Deleted COC ${req.params.id}`);
    res.json({ message: 'COC deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
