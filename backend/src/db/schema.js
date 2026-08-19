import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '..', 'saferoute.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
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
    evidence_url TEXT,
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
`);

try {
  db.exec("ALTER TABLE alerts ADD COLUMN evidence_url TEXT");
} catch (e) {
  // Column already exists
}

export default db;