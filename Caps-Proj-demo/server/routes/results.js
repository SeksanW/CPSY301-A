const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const TEST_TABLES = {
  icp: { table: 'icp', id: 'icp_id', fields: ['ll_tm', 'll_dm', 'ba_tm', 'ba_dm', 'mg_tm'] },
  alkalinity: { table: 'alkalinity', id: 'alkalinity_id', fields: ['p_alk_ppm', 't_alk_ppm', 'hydroxide_ppm', 'carbonate_ppm', 'bicarb_ppm'] },
  ph_conductivity: { table: 'ph_conductivity', id: 'ph_cond_id', fields: ['ph', 'temperature', 'conductivity'] },
  tictoc: { table: 'tictoc', id: 'tictoc_id', fields: ['tic_final_result', 'tic_as_caco3', 'toc_final_result', 'toc_as_caco3'] },
  ic: { table: 'ic', id: 'ic_id', fields: ['f_ppm', 'cl_ppm', 'no2_ppm', 'br_ppm', 'no3_ppm'] },
};

// GET /api/results/:sampleId/:testType
router.get('/:sampleId/:testType', authenticateToken, async (req, res) => {
  const { sampleId, testType } = req.params;
  const meta = TEST_TABLES[testType];
  if (!meta) return res.status(400).json({ message: 'Unknown test type.' });

  try {
    const [rows] = await pool.query(`SELECT * FROM ${meta.table} WHERE sample_id = ?`, [sampleId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/results/:sampleId/:testType  (admin)
router.post('/:sampleId/:testType', authenticateToken, requireAdmin, async (req, res) => {
  const { sampleId, testType } = req.params;
  const meta = TEST_TABLES[testType];
  if (!meta) return res.status(400).json({ message: 'Unknown test type.' });

  const values = meta.fields.map(f => req.body[f] ?? null);
  const placeholders = meta.fields.map(() => '?').join(', ');
  const fieldNames = meta.fields.join(', ');

  try {
    await pool.query(
      `INSERT INTO ${meta.table} (sample_id, ${fieldNames}) VALUES (?, ${placeholders})`,
      [sampleId, ...values]
    );
    res.status(201).json({ message: 'Result added.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PUT /api/results/:sampleId/:testType/:resultId  (admin)
router.put('/:sampleId/:testType/:resultId', authenticateToken, requireAdmin, async (req, res) => {
  const { testType, resultId } = req.params;
  const meta = TEST_TABLES[testType];
  if (!meta) return res.status(400).json({ message: 'Unknown test type.' });

  const setClauses = meta.fields.map(f => `${f} = ?`).join(', ');
  const values = meta.fields.map(f => req.body[f] ?? null);

  try {
    await pool.query(
      `UPDATE ${meta.table} SET ${setClauses} WHERE ${meta.id} = ?`,
      [...values, resultId]
    );
    res.json({ message: 'Result updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// DELETE /api/results/:testType/:resultId  (admin)
router.delete('/:testType/:resultId', authenticateToken, requireAdmin, async (req, res) => {
  const { testType, resultId } = req.params;
  const meta = TEST_TABLES[testType];
  if (!meta) return res.status(400).json({ message: 'Unknown test type.' });

  try {
    await pool.query(`DELETE FROM ${meta.table} WHERE ${meta.id} = ?`, [resultId]);
    res.json({ message: 'Result deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
