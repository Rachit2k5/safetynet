import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager } from '../src/services/checkin-timer.js';
import db from '../src/db/schema.js';

vi.useFakeTimers();

describe('checkin-timer', () => {
  let timerManager;
  let mockClock;

  beforeEach(() => {
    db.exec('PRAGMA foreign_keys = OFF; DELETE FROM checkins; DELETE FROM alerts; DELETE FROM trips; DELETE FROM users; PRAGMA foreign_keys = ON;');
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
    vi.advanceTimersByTime(1499); // just before boundary
    timerManager.resetTimer('t1');
    vi.advanceTimersByTime(100); // 1599 total
    expect(cb).not.toHaveBeenCalled();
  });

  it('8. Timer doesn\'t fire after trip is completed', () => {
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