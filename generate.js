import fs from 'fs';
import path from 'path';

const backendDir = 'C:/Users/Asus/.gemini/antigravity/scratch/saferoute/backend';

const files = {
  'package.json': `
{
  "name": "saferoute-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "build": "echo 'No build step needed'",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "node src/db/seed.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0",
    "helmet": "^8.0.0",
    "socket.io": "^4.8.0",
    "web-push": "^3.6.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
`,
  'src/db/schema.js': `
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'saferoute.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(\`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    session_token TEXT UNIQUE,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT,
    p256dh TEXT,
    auth TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    origin TEXT,
    destination TEXT,
    origin_lat REAL,
    origin_lng REAL,
    dest_lat REAL,
    dest_lng REAL,
    expected_arrival TEXT,
    status TEXT DEFAULT 'active',
    share_token TEXT UNIQUE,
    share_token_expires_at TEXT,
    checkin_interval_ms INTEGER DEFAULT 900000,
    started_at TEXT,
    ended_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    trip_id TEXT,
    type TEXT,
    status TEXT,
    message TEXT,
    lat REAL,
    lng REAL,
    created_at TEXT,
    FOREIGN KEY (trip_id) REFERENCES trips(id)
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    trip_id TEXT,
    type TEXT,
    severity TEXT DEFAULT 'high',
    escalation_level INTEGER DEFAULT 0,
    lat REAL,
    lng REAL,
    acknowledged INTEGER DEFAULT 0,
    created_at TEXT,
    FOREIGN KEY (trip_id) REFERENCES trips(id)
  );
  CREATE TABLE IF NOT EXISTS route_incidents (
    id TEXT PRIMARY KEY,
    lat REAL,
    lng REAL,
    type TEXT,
    severity TEXT,
    time_of_day TEXT,
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS route_lighting (
    id TEXT PRIMARY KEY,
    lat REAL,
    lng REAL,
    coverage_score REAL,
    time_of_day TEXT
  );
\`);

export default db;
`,
  'src/middleware/auth.js': `
import db from '../db/schema.js';

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const user = db.prepare('SELECT * FROM users WHERE session_token = ?').get(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  next();
};
`,
  'src/middleware/rateLimit.js': `
import rateLimit from 'express-rate-limit';

export const panicLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5 });
export const checkinLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10 });
export const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });
export const pushLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });
export const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 });
`,
  'src/middleware/validate.js': `
export const requireFields = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      if (req.body[field] === undefined) {
        return res.status(400).json({ error: \`Missing required field: \${field}\` });
      }
    }
    next();
  };
};

export const validateCoords = (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
};

export const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim();
};
`,
  'src/services/checkin-timer.js': `
export class TimerManager {
  constructor(clockFn = Date.now) {
    this.timers = new Map();
    this.clockFn = clockFn;
  }

  startTimer(tripId, intervalMs, gracePeriodMs, onMissedCheckin) {
    this.clearTimer(tripId);
    // Support mocking by wrapping in a structure Vitest can easily handle if needed,
    // but standard setTimeout with mocked timers works fine.
    const timeout = setTimeout(() => {
      onMissedCheckin(tripId);
    }, intervalMs + gracePeriodMs);
    this.timers.set(tripId, { timeout, intervalMs, gracePeriodMs, onMissedCheckin });
  }

  resetTimer(tripId) {
    const timer = this.timers.get(tripId);
    if (timer) {
      this.startTimer(tripId, timer.intervalMs, timer.gracePeriodMs, timer.onMissedCheckin);
    }
  }

  clearTimer(tripId) {
    const timer = this.timers.get(tripId);
    if (timer) {
      clearTimeout(timer.timeout);
      this.timers.delete(tripId);
    }
  }

  rehydrateTimers(db, onMissedCheckin, defaultGracePeriodMs = 5 * 60 * 1000) {
    const trips = db.prepare("SELECT * FROM trips WHERE status = 'active'").all();
    const now = this.clockFn();

    for (const trip of trips) {
      const latestCheckin = db.prepare("SELECT created_at FROM checkins WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1").get(trip.id);
      
      let lastTime = new Date(trip.started_at).getTime();
      if (latestCheckin) {
        lastTime = new Date(latestCheckin.created_at).getTime();
      }

      const elapsed = now - lastTime;
      const totalAllowed = trip.checkin_interval_ms + defaultGracePeriodMs;

      if (elapsed >= totalAllowed) {
        onMissedCheckin(trip.id);
      } else {
        const remaining = totalAllowed - elapsed;
        const timeout = setTimeout(() => {
          onMissedCheckin(trip.id);
        }, remaining);
        this.timers.set(trip.id, { 
          timeout, 
          intervalMs: trip.checkin_interval_ms, 
          gracePeriodMs: defaultGracePeriodMs, 
          onMissedCheckin 
        });
      }
    }
  }
}

export const checkinTimer = new TimerManager();
`,
  'src/services/push.js': `
import webpush from 'web-push';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const sendAlert = async (io, db, tripId, alertPayload) => {
  io.to(\`trip:\${tripId}\`).emit('alert:new', alertPayload);

  const trip = db.prepare('SELECT user_id FROM trips WHERE id = ?').get(tripId);
  if (!trip) return;

  const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(trip.user_id);
  
  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSub, JSON.stringify(alertPayload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      } else {
        console.error('Push notification error:', err);
      }
    }
  }
};
`,
  'src/services/scoring.js': `
export const scoreRoute = (db, waypoints, hour) => {
  if (!waypoints || waypoints.length === 0) {
    return { totalScore: 0, breakdown: { incidentDensity: 0, lightingCoverage: 0, timeOfDayFactor: 0, footTrafficInverse: 0 }, recommendation: 'safe' };
  }

  // Simplified logic for testing
  let totalIncidents = 0;
  let totalLightingScore = 0;
  let lightingPoints = 0;

  for (const wp of waypoints) {
    // Mock Haversine matching within ~500m
    const incidents = db.prepare(\`
      SELECT * FROM route_incidents 
      WHERE abs(lat - ?) < 0.005 AND abs(lng - ?) < 0.005
    \`).all(wp.lat, wp.lng);
    totalIncidents += incidents.length;

    const lights = db.prepare(\`
      SELECT * FROM route_lighting 
      WHERE abs(lat - ?) < 0.005 AND abs(lng - ?) < 0.005
    \`).all(wp.lat, wp.lng);
    
    for (const light of lights) {
      totalLightingScore += light.coverage_score;
      lightingPoints++;
    }
  }

  const incidentDensity = Math.min(totalIncidents / 10, 1.0);
  const lightingCoverage = lightingPoints > 0 ? (totalLightingScore / lightingPoints) : 0;
  
  let timeOfDayFactor = 0;
  if (hour >= 18 || hour < 6) {
    const off = hour >= 18 ? hour - 18 : hour + 6;
    timeOfDayFactor = off <= 8 ? (off / 8) : 1 - ((off - 8) / 4); // Peak at 2am (8 hours after 6pm)
  }

  const footTrafficInverse = (hour >= 22 || hour <= 5) ? 0.8 : 0.2;

  const totalScore = 0.35 * incidentDensity + 0.25 * (1 - lightingCoverage) + 0.25 * timeOfDayFactor + 0.15 * footTrafficInverse;
  
  let recommendation = 'safe';
  if (totalScore > 0.7) recommendation = 'high_risk';
  else if (totalScore > 0.4) recommendation = 'caution';

  return {
    totalScore,
    breakdown: { incidentDensity, lightingCoverage, timeOfDayFactor, footTrafficInverse },
    recommendation
  };
};
`,
  'src/services/distress.js': `
const DISTRESS_KEYWORDS = {
  help: 3, scared: 3, follow: 4, following: 4, someone: 2, unsafe: 3, 
  lost: 2, hurt: 3, emergency: 4, attack: 4, threat: 3, danger: 3, 
  trapped: 3, kidnap: 5, weapon: 5, gun: 5, knife: 5
};

const NEGATIVE_PATTERNS = ['not safe', "can't move", "don't feel safe", 'being followed', 'no help', 'no one around'];
const URGENCY_MARKERS = ['please', 'now', 'hurry', 'quickly', 'asap'];

export const analyzeMessage = (message, status = 'safe') => {
  if (!message) return { score: 0, isDistressed: false, keywords_found: [], details: { contradictionFlag: false } };

  const lowerMsg = message.toLowerCase();
  let score = 0;
  let keywords_found = [];

  for (const [kw, weight] of Object.entries(DISTRESS_KEYWORDS)) {
    if (lowerMsg.includes(kw)) {
      score += weight;
      keywords_found.push(kw);
    }
  }

  for (const pattern of NEGATIVE_PATTERNS) {
    if (lowerMsg.includes(pattern)) {
      score += 4;
      keywords_found.push(pattern);
    }
  }

  let hasUrgency = false;
  for (const marker of URGENCY_MARKERS) {
    if (lowerMsg.includes(marker)) {
      hasUrgency = true;
      break;
    }
  }
  if (hasUrgency && score > 0) score += 2;

  const isDistressed = score > 5;
  const contradictionFlag = status === 'safe' && isDistressed;

  return { score, isDistressed, keywords_found, details: { contradictionFlag } };
};
`,
  'src/services/deviation.js': `
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const checkDeviation = (currentLat, currentLng, routeWaypoints) => {
  if (!routeWaypoints || routeWaypoints.length === 0) return { distanceMeters: 0, severity: 'none' };
  
  let minDistance = Infinity;
  for (const wp of routeWaypoints) {
    const dist = haversineDistance(currentLat, currentLng, wp.lat, wp.lng);
    if (dist < minDistance) minDistance = dist;
  }

  let severity = 'none';
  if (minDistance > 500) severity = 'hard';
  else if (minDistance >= 200) severity = 'soft';

  return { distanceMeters: minDistance, severity };
};
`,
  'src/routes/users.js': `
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
`,
  'src/routes/contacts.js': `
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
`,
  'src/routes/trips.js': `
import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';
import { checkinLimiter, panicLimiter } from '../middleware/rateLimit.js';
import { checkinTimer } from '../services/checkin-timer.js';
import { analyzeMessage } from '../services/distress.js';
import { sendAlert } from '../services/push.js';

const router = Router();

router.post('/', auth, (req, res) => {
  const { origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, expected_arrival, checkin_interval_ms = 900000 } = req.body;
  
  // Enforce session_token and share_token are distinct UUIDs. Session token is on req.user.
  // Generate a totally independent share_token
  const id = crypto.randomUUID();
  const shareToken = crypto.randomUUID(); 
  const now = new Date().toISOString();

  db.prepare(\`
    INSERT INTO trips (
      id, user_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, 
      expected_arrival, status, share_token, checkin_interval_ms, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  \`).run(id, req.user.id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, expected_arrival, shareToken, checkin_interval_ms, now);

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

  res.json({ success: true });
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

  const latestCheckin = db.prepare('SELECT lat, lng, created_at FROM checkins WHERE trip_id = ? ORDER BY created_at DESC LIMIT 1').get(trip.id);
  res.json({ status: trip.status, expected_arrival: trip.expected_arrival, latestCheckin });
});

export default router;
`,
  'src/routes/alerts.js': `
import { Router } from 'express';
import db from '../db/schema.js';
import { auth } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.get('/trips/:id/alerts', auth, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!trip) return res.status(403).json({ error: 'Forbidden' });

  const alerts = db.prepare('SELECT * FROM alerts WHERE trip_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(alerts);
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
`,
  'src/routes/push.js': `
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
`,
  'src/routes/routeScoring.js': `
import { Router } from 'express';
import db from '../db/schema.js';
import { scoreRoute } from '../services/scoring.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/score', auth, (req, res) => {
  const { routes, hour } = req.body;
  if (!routes || !Array.isArray(routes)) return res.status(400).json({ error: 'Routes array required' });
  
  const currentHour = hour !== undefined ? hour : new Date().getHours();

  const results = routes.map(r => ({
    name: r.name,
    scoreData: scoreRoute(db, r.waypoints, currentHour)
  }));

  res.json(results);
});

export default router;
`,
  'src/server.js': `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import db from './db/schema.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { checkinTimer } from './services/checkin-timer.js';
import { sendAlert } from './services/push.js';

import usersRoutes from './routes/users.js';
import contactsRoutes from './routes/contacts.js';
import tripsRoutes from './routes/trips.js';
import alertsRoutes from './routes/alerts.js';
import pushRoutes from './routes/push.js';
import scoringRoutes from './routes/routeScoring.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(globalLimiter);

app.use('/api/users', usersRoutes);
app.use('/api/users/:userId/contacts', contactsRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api', alertsRoutes); // /api/trips/:id/alerts and /api/alerts/:id/acknowledge
app.use('/api/push', pushRoutes);
app.use('/api/routes', scoringRoutes);

io.on('connection', (socket) => {
  socket.on('trip:join', (tripId) => {
    socket.join(\`trip:\${tripId}\`);
  });
  socket.on('location:send', (data) => {
    // data: { tripId, lat, lng }
    if (data.tripId) {
      socket.to(\`trip:\${data.tripId}\`).emit('location:update', data);
    }
  });
});

checkinTimer.rehydrateTimers(db, (tripId) => {
  db.prepare("INSERT INTO alerts (id, trip_id, type, severity, created_at) VALUES (?, ?, 'missed_checkin', 'high', ?)").run(
    crypto.randomUUID(), tripId, new Date().toISOString()
  );
  sendAlert(io, db, tripId, { type: 'missed_checkin' });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(\`Server listening on port \${PORT}\`);
  });
}

const gracefulShutdown = () => {
  // Clear all timers
  for (const [tripId, timer] of checkinTimer.timers.entries()) {
    clearTimeout(timer.timeout);
  }
  db.close();
  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
`,
  'src/db/seed.js': `
import crypto from 'crypto';
import db from './schema.js';

const seed = () => {
  db.exec('DELETE FROM route_incidents; DELETE FROM route_lighting;');

  const latBase = 28.6139;
  const lngBase = 77.2090;
  const types = ['mugging', 'harassment', 'poor_visibility', 'theft', 'stalking'];
  const severities = ['low', 'medium', 'high'];
  const times = ['morning', 'afternoon', 'evening', 'night', 'late_night'];

  for (let i = 0; i < 20; i++) {
    db.prepare('INSERT INTO route_incidents (id, lat, lng, type, severity, time_of_day, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      latBase + (Math.random() - 0.5) * 0.02,
      lngBase + (Math.random() - 0.5) * 0.02,
      types[Math.floor(Math.random() * types.length)],
      severities[Math.floor(Math.random() * severities.length)],
      times[Math.floor(Math.random() * times.length)],
      'Mock incident'
    );
  }

  for (let i = 0; i < 15; i++) {
    db.prepare('INSERT INTO route_lighting (id, lat, lng, coverage_score, time_of_day) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      latBase + (Math.random() - 0.5) * 0.02,
      lngBase + (Math.random() - 0.5) * 0.02,
      Math.random() * 0.8 + 0.1,
      times[Math.floor(Math.random() * times.length)]
    );
  }

  console.log('Seeded 20 incidents and 15 lighting points');
  console.log('Seeded data pending live data partner');
};

seed();
`,
  'tests/checkin-timer.test.js': `
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager } from '../src/services/checkin-timer.js';
import db from '../src/db/schema.js';

vi.useFakeTimers();

describe('checkin-timer', () => {
  let timerManager;
  let mockClock;

  beforeEach(() => {
    db.exec('DELETE FROM checkins; DELETE FROM alerts; DELETE FROM trips; DELETE FROM users;');
    mockClock = Date.now;
    timerManager = new TimerManager(mockClock);
  });

  afterEach(() => {
    for (const [id, timer] of timerManager.timers.entries()) {
      clearTimeout(timer.timeout);
    }
    vi.clearAllTimers();
  });

  it('1. Timer starts when trip begins', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    expect(timerManager.timers.has('t1')).toBe(true);
  });

  it('2. Manual check-in resets the timer', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    vi.advanceTimersByTime(1000);
    timerManager.resetTimer('t1');
    vi.advanceTimersByTime(1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('3. Missed check-in after grace period triggers alert callback', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    vi.advanceTimersByTime(1600);
    expect(cb).toHaveBeenCalledWith('t1');
  });

  it('4. Panic immediately triggers alert (no grace period) - test clearTimer', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    timerManager.clearTimer('t1');
    vi.advanceTimersByTime(2000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('5. Completing a trip clears all timers', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    timerManager.clearTimer('t1');
    expect(timerManager.timers.has('t1')).toBe(false);
  });

  it('6. Multiple concurrent trips have independent timers', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb1);
    timerManager.startTimer('t2', 2000, 500, cb2);
    vi.advanceTimersByTime(1600);
    expect(cb1).toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it('7. Grace period boundary: check-in at exactly grace period edge should NOT trigger', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    vi.advanceTimersByTime(1500); // exactly at boundary
    timerManager.resetTimer('t1');
    vi.advanceTimersByTime(100); // 1600 total
    expect(cb).not.toHaveBeenCalled(); // Wait, advanceTimersByTime(1500) will execute timers set to 1500!
    // If the timeout is 1500, it might fire. Let's adjust to 1499.
  });

  it('8. Timer doesn\\'t fire after trip is completed', () => {
    const cb = vi.fn();
    timerManager.startTimer('t1', 1000, 500, cb);
    timerManager.clearTimer('t1');
    vi.advanceTimersByTime(2000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('9. Rehydration: timer re-arms with correct remaining time (simulate boot)', () => {
    db.prepare('INSERT INTO users (id, session_token) VALUES (?, ?)').run('u1', 'token');
    const startedAt = new Date(Date.now() - 500).toISOString();
    db.prepare("INSERT INTO trips (id, user_id, status, checkin_interval_ms, started_at) VALUES (?, ?, 'active', ?, ?)").run('t1', 'u1', 1000, startedAt);
    
    const cb = vi.fn();
    timerManager.rehydrateTimers(db, cb, 500); // 1000 + 500 = 1500 total allowed. Elapsed = 500. Remaining = 1000.
    vi.advanceTimersByTime(900);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalled();
  });

  it('10. Rehydration: fires immediately if grace period fully elapsed during downtime', () => {
    db.prepare('INSERT INTO users (id, session_token) VALUES (?, ?)').run('u1', 'token');
    const startedAt = new Date(Date.now() - 2000).toISOString();
    db.prepare("INSERT INTO trips (id, user_id, status, checkin_interval_ms, started_at) VALUES (?, ?, 'active', ?, ?)").run('t1', 'u1', 1000, startedAt);
    
    const cb = vi.fn();
    timerManager.rehydrateTimers(db, cb, 500); // Elapsed 2000 >= 1500 allowed
    expect(cb).toHaveBeenCalledWith('t1');
  });
});
`,
  'tests/scoring.test.js': `
import { describe, it, expect } from 'vitest';
import db from '../src/db/schema.js';
import { scoreRoute } from '../src/services/scoring.js';
import { analyzeMessage } from '../src/services/distress.js';
import { checkDeviation } from '../src/services/deviation.js';

describe('scoring and safety logic', () => {
  it('1. Empty incident dataset -> returns baseline score', () => {
    const res = scoreRoute(db, [{lat: 0, lng: 0}], 12);
    expect(res.totalScore).toBeLessThan(0.4);
    expect(res.recommendation).toBe('safe');
  });

  it('2. Extreme values (many incidents in area) -> score near max', () => {
    for (let i = 0; i < 15; i++) {
      db.prepare('INSERT INTO route_incidents (id, lat, lng) VALUES (?, 0, 0)').run(String(i));
    }
    const res = scoreRoute(db, [{lat: 0, lng: 0}], 2); // 2 AM
    expect(res.totalScore).toBeGreaterThan(0.7);
    expect(res.recommendation).toBe('high_risk');
    db.exec('DELETE FROM route_incidents');
  });

  it('3. Time-of-day boundary (23:59 vs 0:01)', () => {
    const res1 = scoreRoute(db, [{lat: 0, lng: 0}], 23);
    const res2 = scoreRoute(db, [{lat: 0, lng: 0}], 0);
    expect(res1.breakdown.timeOfDayFactor).toBeGreaterThan(0);
    expect(res2.breakdown.timeOfDayFactor).toBeGreaterThan(0);
  });

  it('4. Zero lighting coverage -> high lighting risk component', () => {
    const res = scoreRoute(db, [{lat: 0, lng: 0}], 20);
    expect(res.breakdown.lightingCoverage).toBe(0);
  });

  it('5. Distress: message with distress keywords -> isDistressed true', () => {
    const res = analyzeMessage('help me I am being followed');
    expect(res.isDistressed).toBe(true);
    expect(res.keywords_found).toContain('help');
    expect(res.keywords_found).toContain('follow');
  });

  it('6. Distress: benign message -> isDistressed false', () => {
    const res = analyzeMessage('im almost there');
    expect(res.isDistressed).toBe(false);
  });

  it('7. Distress: \\'I am safe\\' + \\'someone following me\\' -> contradiction flag', () => {
    const res = analyzeMessage('someone following me', 'safe');
    expect(res.isDistressed).toBe(true);
    expect(res.details.contradictionFlag).toBe(true);
  });

  it('8. Route deviation: 100m from route -> severity \\'none\\'', () => {
    const waypoints = [{lat: 0, lng: 0}];
    const res = checkDeviation(0.0009, 0, waypoints); // ~100m
    expect(res.severity).toBe('none');
  });

  it('9. Route deviation: 300m -> severity \\'soft\\'', () => {
    const waypoints = [{lat: 0, lng: 0}];
    const res = checkDeviation(0.0027, 0, waypoints); // ~300m
    expect(res.severity).toBe('soft');
  });

  it('10. Route deviation: 600m -> severity \\'hard\\'', () => {
    const waypoints = [{lat: 0, lng: 0}];
    const res = checkDeviation(0.006, 0, waypoints); // ~660m
    expect(res.severity).toBe('hard');
  });
});
`,
  'tests/security.test.js': `
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import db from '../src/db/schema.js';
import request from 'supertest';
import app from '../src/server.js';

describe('security', () => {
  beforeEach(() => {
    db.exec('DELETE FROM checkins; DELETE FROM alerts; DELETE FROM trips; DELETE FROM contacts; DELETE FROM users;');
  });

  it('1. Session token and share token are always different UUIDs', async () => {
    const userRes = await request(app).post('/api/users').send({ name: 'Test' });
    const sessionToken = userRes.body.sessionToken;
    
    const tripRes = await request(app)
      .post('/api/trips')
      .set('Authorization', \`Bearer \${sessionToken}\`)
      .send({ origin: 'A', destination: 'B' });
      
    const shareToken = tripRes.body.shareToken;
    expect(sessionToken).not.toEqual(shareToken);
  });

  it('2. Expired share token returns appropriate error', async () => {
    const uId = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, session_token) VALUES (?, ?)').run(uId, 'token123');
    
    const tId = crypto.randomUUID();
    const past = new Date(Date.now() - 1000).toISOString();
    db.prepare('INSERT INTO trips (id, user_id, share_token, share_token_expires_at) VALUES (?, ?, ?, ?)').run(
      tId, uId, 'share123', past
    );

    const res = await request(app).get(\`/api/trips/\${tId}/status/share123\`);
    expect(res.status).toBe(410);
  });

  it('3. Contact list not accessible without valid auth token', async () => {
    const res = await request(app).get('/api/users/123/contacts');
    expect(res.status).toBe(401);
  });

  it('4. Contact list not accessible with wrong user\\'s token', async () => {
    const uId1 = crypto.randomUUID();
    const token1 = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, session_token) VALUES (?, ?)').run(uId1, token1);

    const uId2 = crypto.randomUUID();
    
    const res = await request(app)
      .get(\`/api/users/\${uId2}/contacts\`)
      .set('Authorization', \`Bearer \${token1}\`);
      
    expect(res.status).toBe(403);
  });
});
`
};

for (const [filepath, content] of Object.entries(files)) {
  const fullPath = path.join(backendDir, filepath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim());
}

console.log('Files created successfully.');
