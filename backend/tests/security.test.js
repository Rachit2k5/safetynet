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
      .set('Authorization', `Bearer ${sessionToken}`)
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

    const res = await request(app).get(`/api/trips/${tId}/status/share123`);
    expect(res.status).toBe(410);
  });

  it('3. Contact list not accessible without valid auth token', async () => {
    const res = await request(app).get('/api/users/123/contacts');
    expect(res.status).toBe(401);
  });

  it('4. Contact list not accessible with wrong user\'s token', async () => {
    const uId1 = crypto.randomUUID();
    const token1 = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, session_token) VALUES (?, ?)').run(uId1, token1);

    const uId2 = crypto.randomUUID();
    
    const res = await request(app)
      .get(`/api/users/${uId2}/contacts`)
      .set('Authorization', `Bearer ${token1}`);
      
    expect(res.status).toBe(403);
  });
});