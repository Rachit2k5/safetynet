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