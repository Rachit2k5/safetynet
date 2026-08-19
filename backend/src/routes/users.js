import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';

const router = Router();

router.post('/', requireFields(['name']), (req, res) => {
  const { name } = req.body;
  const id = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  
  db.prepare('INSERT INTO users (id, name, session_token, created_at) VALUES (?, ?, ?, ?)').run(
    id, name, sessionToken, new Date().toISOString()
  );

  res.status(201).json({ id, name, sessionToken });
});

router.get('/me', auth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name });
});

export default router;