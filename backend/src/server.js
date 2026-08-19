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

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static('uploads'));
app.use(globalLimiter);

app.use('/api/users', usersRoutes);
app.use('/api/users/:userId/contacts', contactsRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api', alertsRoutes); // /api/trips/:id/alerts and /api/alerts/:id/acknowledge
app.use('/api/push', pushRoutes);
app.use('/api/routes', scoringRoutes);

io.on('connection', (socket) => {
  socket.on('trip:join', (tripId) => {
    socket.join(`trip:${tripId}`);
  });
  socket.on('location:send', (data) => {
    // data: { tripId, lat, lng }
    if (data.tripId) {
      socket.to(`trip:${data.tripId}`).emit('location:update', data);
    }
  });
});

checkinTimer.rehydrateTimers(db, (tripId) => {
  db.prepare("INSERT INTO alerts (id, trip_id, type, severity, created_at) VALUES (?, ?, 'missed_checkin', 'high', ?)").run(
    crypto.randomUUID(), tripId, new Date().toISOString()
  );
  sendAlert(io, db, tripId, { type: 'missed_checkin' });
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
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