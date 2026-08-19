import asyncio
import time
from datetime import datetime, timezone

class TimerManager:
    def __init__(self, clock_fn=None):
        self.timers = {}
        self.clock_fn = clock_fn or (lambda: time.time() * 1000)

    def start_timer(self, trip_id: str, interval_ms: int, grace_period_ms: int, on_missed_cb):
        self.clear_timer(trip_id)
        
        async def task_runner():
            total_delay = (interval_ms + grace_period_ms) / 1000.0
            await asyncio.sleep(total_delay)
            if asyncio.iscoroutinefunction(on_missed_cb):
                await on_missed_cb(trip_id)
            else:
                on_missed_cb(trip_id)

        task = asyncio.create_task(task_runner())
        self.timers[trip_id] = {
            "task": task,
            "interval_ms": interval_ms,
            "grace_period_ms": grace_period_ms,
            "cb": on_missed_cb
        }

    def reset_timer(self, trip_id: str):
        timer = self.timers.get(trip_id)
        if timer:
            self.start_timer(trip_id, timer["interval_ms"], timer["grace_period_ms"], timer["cb"])

    def clear_timer(self, trip_id: str):
        timer = self.timers.get(trip_id)
        if timer:
            timer["task"].cancel()
            del self.timers[trip_id]

    async def rehydrate_timers(self, db, on_missed_cb, default_grace_period_ms=300000):
        trips = db["trips"].find({"status": "active"})
        now_ms = self.clock_fn()

        for trip in trips:
            trip_id = trip["_id"]
            checkins = db["checkins"].find({"trip_id": trip_id}, sort=[("created_at", -1)], limit=1)
            
            if checkins:
                last_time_str = checkins[0]["created_at"]
            else:
                last_time_str = trip["started_at"]
                
            try:
                dt = datetime.fromisoformat(last_time_str.replace("Z", "+00:00"))
                last_time_ms = dt.timestamp() * 1000
            except Exception:
                last_time_ms = now_ms

            elapsed_ms = now_ms - last_time_ms
            interval_ms = trip.get("checkin_interval_ms", 900000)
            total_allowed = interval_ms + default_grace_period_ms

            if elapsed_ms >= total_allowed:
                if asyncio.iscoroutinefunction(on_missed_cb):
                    await on_missed_cb(trip_id)
                else:
                    on_missed_cb(trip_id)
            else:
                remaining_sec = (total_allowed - elapsed_ms) / 1000.0

                async def remaining_task(t_id=trip_id, delay=remaining_sec):
                    await asyncio.sleep(delay)
                    if asyncio.iscoroutinefunction(on_missed_cb):
                        await on_missed_cb(t_id)
                    else:
                        on_missed_cb(t_id)

                task = asyncio.create_task(remaining_task())
                self.timers[trip_id] = {
                    "task": task,
                    "interval_ms": interval_ms,
                    "grace_period_ms": default_grace_period_ms,
                    "cb": on_missed_cb
                }

checkin_timer = TimerManager()
