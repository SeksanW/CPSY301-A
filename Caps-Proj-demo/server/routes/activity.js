const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

// Shared helper — call this from other routes to log an action
async function logActivity(action, cocId, performedBy, details) {
  try {
    await pool.query(
      'INSERT INTO activity_log (action, coc_id, performed_by, details) VALUES (?, ?, ?, ?)',
      [action, cocId || null, performedBy || null, details || null]
    );
  } catch (_) {
    // Never let logging break the main operation
  }
}

// POST /api/activity — log a single event from the frontend
router.post('/', authenticateToken, async (req, res) => {
  const { action, coc_id, details } = req.body;
  if (!action) return res.status(400).json({ message: 'action is required.' });
  await logActivity(action, coc_id || null, req.user.username, details || null);
  res.status(201).json({ message: 'Logged.' });
});

// GET /api/activity — recent 50 events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = { router, logActivity };
