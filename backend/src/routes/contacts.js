import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimit.js';

const router = Router({ mergeParams: true });

router.use(auth);

router.post('/', contactLimiter, requireFields(['name', 'email', 'phone']), (req, res) => {
  if (req.user.id !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
  
  const contacts = db.prepare('SELECT count(*) as count FROM contacts WHERE user_id = ?').get(req.user.id);
  if (contacts.count >= 3) return res.status(400).json({ error: 'Max 3 contacts allowed' });

  const id = crypto.randomUUID();
  const { name, email, phone } = req.body;
  
  db.prepare('INSERT INTO contacts (id, user_id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, req.user.id, name, email, phone, new Date().toISOString()
  );

  res.status(201).json({ id, name, email, phone });
});

router.get('/', (req, res) => {
  if (req.user.id !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
  const contacts = db.prepare('SELECT * FROM contacts WHERE user_id = ?').all(req.user.id);
  res.json(contacts);
});

router.delete('/:contactId', (req, res) => {
  if (req.user.id !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(req.params.contactId, req.user.id);
  res.json({ success: true });
});

export default router;