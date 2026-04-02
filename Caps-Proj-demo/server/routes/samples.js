const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/samples?coc_id=...
router.get('/', authenticateToken, async (req, res) => {
  const { coc_id } = req.query;
  if (!coc_id) return res.status(400).json({ message: 'coc_id query param required.' });

  try {
    const [rows] = await pool.query('SELECT * FROM samples WHERE coc_id = ?', [coc_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/samples/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM samples WHERE sample_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Sample not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/samples  (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { sample_id, coc_id, sample_type, description, sample_point, matrix } = req.body;
  if (!sample_id || !coc_id) return res.status(400).json({ message: 'sample_id and coc_id are required.' });

  try {
    const [cocCheck] = await pool.query('SELECT coc_id FROM coc_doc WHERE coc_id = ?', [coc_id]);
    if (cocCheck.length === 0) return res.status(404).json({ message: 'COC not found.' });

    await pool.query(
      'INSERT INTO samples (sample_id, coc_id, sample_type, description, sample_point, matrix) VALUES (?, ?, ?, ?, ?, ?)',
      [sample_id, coc_id, sample_type, description, sample_point, matrix]
    );
    res.status(201).json({ message: 'Sample added successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Sample ID already exists.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /api/samples/:id  (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { sample_type, description, sample_point, matrix } = req.body;
  try {
    await pool.query(
      'UPDATE samples SET sample_type=?, description=?, sample_point=?, matrix=? WHERE sample_id=?',
      [sample_type, description, sample_point, matrix, req.params.id]
    );
    res.json({ message: 'Sample updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/samples/:id  (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT sample_id FROM samples WHERE sample_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Sample not found.' });
    await pool.query('DELETE FROM samples WHERE sample_id = ?', [req.params.id]);
    res.json({ message: 'Sample deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
