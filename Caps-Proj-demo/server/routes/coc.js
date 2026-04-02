const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const pool = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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
      [coc_id, project_name, report_name, report_email, submitted_by, notes]
    );
    res.status(201).json({ message: 'COC created successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/coc/upload  — upload Excel file (admin)
router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  const { coc_id } = req.body;
  if (!coc_id) return res.status(400).json({ message: 'COC ID is required.' });

  try {
    const [existing] = await pool.query('SELECT coc_id FROM coc_doc WHERE coc_id = ?', [coc_id]);
    if (existing.length > 0) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ message: 'COC already exists. Delete or edit the existing one.' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

    await pool.query(
      'INSERT INTO coc_doc (coc_id, project_name, file_path, submitted_by) VALUES (?, ?, ?, ?)',
      [coc_id, sheetName, req.file.filename, req.user.username]
    );

    // Insert samples from Excel rows
    for (const row of data) {
      const sampleId = row['Sample ID'] || row['sample_id'];
      if (!sampleId) continue;
      await pool.query(
        'INSERT IGNORE INTO samples (sample_id, coc_id, sample_type, description) VALUES (?, ?, ?, ?)',
        [String(sampleId), coc_id, row['Sample Type'] || null, row['Description'] || null]
      );
    }

    res.status(201).json({ message: 'COC uploaded and parsed successfully.', rows: data.length });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'File processing error.', error: err.message });
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
    res.json({ message: 'COC deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
