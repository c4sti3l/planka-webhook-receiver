import { Router } from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../services/database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin LIMIT 1').get();

  if (!admin) {
    return res.status(500).json({ error: 'No admin user configured' });
  }

  const valid = await bcrypt.compare(password, admin.password_hash);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = generateToken(admin.id);
  res.json({ token });
});

router.get('/check', authMiddleware, (req, res) => {
  res.json({ valid: true });
});

router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin LIMIT 1').get();

  const valid = await bcrypt.compare(currentPassword, admin.password_hash);

  if (!valid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE admin SET password_hash = ? WHERE id = ?').run(newHash, admin.id);

  res.json({ success: true });
});

export default router;
