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

  it('7. Distress: \'I am safe\' + \'someone following me\' -> contradiction flag', () => {
    const res = analyzeMessage('someone following me', 'safe');
    expect(res.isDistressed).toBe(true);
    expect(res.details.contradictionFlag).toBe(true);
  });

  it('8. Route deviation: 100m from route -> severity \'none\'', () => {
    const waypoints = [{lat: 0, lng: 0}];
    const res = checkDeviation(0.0009, 0, waypoints); // ~100m
    expect(res.severity).toBe('none');
  });

  it('9. Route deviation: 300m -> severity \'soft\'', () => {
    const waypoints = [{lat: 0, lng: 0}];
    const res = checkDeviation(0.0027, 0, waypoints); // ~300m
    expect(res.severity).toBe('soft');
  });

  it('10. Route deviation: 600m -> severity \'hard\'', () => {
    const waypoints = [{lat: 0, lng: 0}];
    const res = checkDeviation(0.006, 0, waypoints); // ~660m
    expect(res.severity).toBe('hard');
  });
});