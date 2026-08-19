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