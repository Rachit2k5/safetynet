import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';
import { sendAlert } from '../services/push.js';

const router = Router({ mergeParams: true });

router.get('/trips/:id/alerts', auth, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!trip) return res.status(403).json({ error: 'Forbidden' });

  const alerts = db.prepare('SELECT * FROM alerts WHERE trip_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(alerts);
});

router.post('/alerts/:id/evidence', (req, res) => {
  const { audioData, shareToken } = req.body;
  if (!audioData) return res.status(400).json({ error: 'audioData base64 required' });

  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  // Save base64 data to uploads/
  const base64Clean = audioData.replace(/^data:(audio|video)\/[a-z0-9]+;base64,/, '');
  const filename = `evidence_${alert.id}_${Date.now()}.webm`;
  const filePath = path.join(process.cwd(), 'uploads', filename);

  fs.writeFileSync(filePath, Buffer.from(base64Clean, 'base64'));

  const evidenceUrl = `/uploads/${filename}`;
  db.prepare('UPDATE alerts SET evidence_url = ? WHERE id = ?').run(evidenceUrl, alert.id);

  // Broadcast update over Socket.IO to contact view
  const io = req.app.get('io');
  if (io) {
    io.to(`trip:${alert.trip_id}`).emit('alert:evidence', { alertId: alert.id, evidenceUrl });
  }

  res.json({ success: true, evidenceUrl });
});

router.put('/alerts/:id/acknowledge', (req, res) => {
  const { shareToken } = req.body;
  if (!shareToken) return res.status(400).json({ error: 'shareToken required' });

  const alert = db.prepare('SELECT trip_id FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Not found' });

  const trip = db.prepare('SELECT share_token FROM trips WHERE id = ?').get(alert.trip_id);
  if (!trip || trip.share_token !== shareToken) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;