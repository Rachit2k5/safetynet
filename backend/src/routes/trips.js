import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';
import { checkinLimiter, panicLimiter } from '../middleware/rateLimit.js';
import { checkinTimer } from '../services/checkin-timer.js';
import { analyzeMessage } from '../services/distress.js';
import { sendAlert } from '../services/push.js';

const router = Router();

router.get('/', auth, (req, res) => {
  const trips = db.prepare("SELECT * FROM trips WHERE user_id = ? ORDER BY started_at DESC").all(req.user.id);
  res.json(trips);
});

router.post('/', auth, (req, res) => {
  const { 
    origin = 'Current Location', 
    destination = 'Destination', 
    origin_lat = 28.6139, 
    origin_lng = 77.2090, 
    dest_lat = 28.6180, 
    dest_lng = 77.2150, 
    expected_arrival, 
    checkin_interval_ms = 900000 
  } = req.body;
  
  const id = crypto.randomUUID();
  const shareToken = crypto.randomUUID(); 
  const now = new Date().toISOString();
  const arrival = expected_arrival || new Date(Date.now() + 30 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO trips (
      id, user_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, 
      expected_arrival, status, share_token, checkin_interval_ms, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(id, req.user.id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, arrival, shareToken, checkin_interval_ms, now);

  checkinTimer.startTimer(id, checkin_interval_ms, 5 * 60 * 1000, (tripId) => {
    db.prepare("INSERT INTO alerts (id, trip_id, type, severity, created_at) VALUES (?, ?, 'missed_checkin', 'high', ?)").run(
      crypto.randomUUID(), tripId, new Date().toISOString()
    );
    sendAlert(req.app.get('io'), db, tripId, { type: 'missed_checkin' });
  });

  res.status(201).json({ id, shareToken });
});

router.get('/active', auth, (req, res) => {
  const trip = db.prepare("SELECT * FROM trips WHERE user_id = ? AND status = 'active'").get(req.user.id);
  if (!trip) return res.status(404).json({ error: 'No active trip' });
  res.json(trip);
});

router.get('/:id', auth, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Not found' });
  res.json(trip);
});

router.put('/:id/checkin', auth, checkinLimiter, (req, res) => {
  const { status, message, lat, lng } = req.body;
  const analysis = analyzeMessage(message, status);
  
  db.prepare('INSERT INTO checkins (id, trip_id, type, status, message, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(), req.params.id, 'manual', status, message, lat, lng, new Date().toISOString()
  );

  checkinTimer.resetTimer(req.params.id);

  if (analysis.isDistressed) {
     const alertId = crypto.randomUUID();
     db.prepare("INSERT INTO alerts (id, trip_id, type, severity, lat, lng, created_at) VALUES (?, ?, 'distress_message', 'high', ?, ?, ?)").run(
       alertId, req.params.id, lat, lng, new Date().toISOString()
     );
     sendAlert(req.app.get('io'), db, req.params.id, { type: 'distress_message', alertId, lat, lng });
  }

  res.json({ success: true, details: analysis.details });
});

router.put('/:id/panic', auth, panicLimiter, (req, res) => {
  const { lat, lng } = req.body;
  db.prepare("UPDATE trips SET status = 'panic' WHERE id = ?").run(req.params.id);
  
  checkinTimer.clearTimer(req.params.id);
  
  const alertId = crypto.randomUUID();
  db.prepare("INSERT INTO alerts (id, trip_id, type, severity, lat, lng, created_at) VALUES (?, ?, 'panic', 'critical', ?, ?, ?)").run(
    alertId, req.params.id, lat, lng, new Date().toISOString()
  );

  sendAlert(req.app.get('io'), db, req.params.id, { type: 'panic', alertId, lat, lng });

  res.json({ success: true, alertId });
});

router.put('/:id/complete', auth, (req, res) => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare("UPDATE trips SET status = 'completed', ended_at = ?, share_token_expires_at = ? WHERE id = ? AND user_id = ?").run(
    new Date().toISOString(), expiresAt, req.params.id, req.user.id
  );
  
  checkinTimer.clearTimer(req.params.id);
  res.json({ success: true });
});

router.get('/:id/status/:shareToken', (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND share_token = ?').get(req.params.id, req.params.shareToken);
  if (!trip) return res.status(404).json({ error: 'Not found' });
  
  if (trip.share_token_expires_at && new Date(trip.share_token_expires_at) < new Date()) {
    return res.status(410).json({ error: 'Link expired' });
  }

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(trip.user_id);
  const latestCheckin = db.prepare('SELECT lat, lng, created_at, message FROM checkins WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1').get(trip.id);
  const alerts = db.prepare('SELECT id, type, severity, lat, lng, evidence_url, created_at FROM alerts WHERE trip_id = ? ORDER BY created_at DESC').all(trip.id);

  res.json({ 
    id: trip.id,
    origin: trip.origin,
    destination: trip.destination,
    status: trip.status, 
    expected_arrival: trip.expected_arrival, 
    user: user || { name: 'Traveler' },
    latestCheckin,
    alerts
  });
});

export default router;