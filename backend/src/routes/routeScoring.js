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