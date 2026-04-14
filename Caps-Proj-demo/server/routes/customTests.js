const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/custom-tests/:sampleId
router.get('/:sampleId', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM custom_tests WHERE sample_id = ? ORDER BY created_at ASC',
      [req.params.sampleId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/custom-tests/:sampleId
router.post('/:sampleId', authenticateToken, requireAdmin, async (req, res) => {
  const { test_name, fields } = req.body;
  if (!test_name) return res.status(400).json({ message: 'Test name is required.' });
  if (!fields || typeof fields !== 'object') return res.status(400).json({ message: 'Fields are required.' });
  try {
    const [result] = await pool.query(
      'INSERT INTO custom_tests (sample_id, test_name, fields) VALUES (?, ?, ?)',
      [req.params.sampleId, test_name, JSON.stringify(fields)]
    );
    res.status(201).json({ message: 'Custom test created.', custom_test_id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /api/custom-tests/:testId
router.put('/:testId', authenticateToken, requireAdmin, async (req, res) => {
  const { test_name, fields } = req.body;
  try {
    await pool.query(
      'UPDATE custom_tests SET test_name = ?, fields = ? WHERE custom_test_id = ?',
      [test_name, JSON.stringify(fields), req.params.testId]
    );
    res.json({ message: 'Custom test updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/custom-tests/:testId
router.delete('/:testId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM custom_tests WHERE custom_test_id = ?', [req.params.testId]);
    res.json({ message: 'Custom test deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
