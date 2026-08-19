import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';
import { pushLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/subscribe', auth, pushLimiter, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Invalid subscription' });

  db.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), req.user.id, endpoint, keys.p256dh, keys.auth, new Date().toISOString()
  );

  res.status(201).json({ success: true });
});

router.delete('/unsubscribe', auth, (req, res) => {
  const { endpoint } = req.body;
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
  res.json({ success: true });
});

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'no_key' });
});

export default router;