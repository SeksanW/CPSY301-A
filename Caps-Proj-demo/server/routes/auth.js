const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is locked. Contact admin.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    await pool.query('UPDATE users SET is_online = TRUE WHERE user_id = ?', [user.user_id]);

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { user_id: user.user_id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_online = FALSE WHERE user_id = ?', [req.user.user_id]);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// POST /api/auth/register  (admin only)
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
  const { username, name, email, password, role } = req.body;
  if (!username || !name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [username, name, email, hash, role || 'user']
    );
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// GET /api/auth/users  (admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, username, name, email, role, is_active, is_online, created_at FROM users'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// PATCH /api/auth/users/:id/toggle-active  (admin only)
router.patch('/users/:id/toggle-active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE user_id = ?', [req.params.id]);
    res.json({ message: 'User status updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
