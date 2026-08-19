import json
import os
import asyncio
from app.db.mongodb import get_db

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:safety@saferoute.app")

async def broadcast_alert(active_websockets, trip_id: str, alert_payload: dict):
    db = get_db()

    # 1. Broadcast over active WebSockets for open tabs
    room_sockets = active_websockets.get(trip_id, [])
    for ws in list(room_sockets):
        try:
            await ws.send_json({"type": "alert:new", "data": alert_payload})
        except Exception:
            pass

    # 2. Query push subscriptions for closed-tab system notifications
    trip = db["trips"].find_one({"_id": trip_id})
    if not trip:
        return

    user_id = trip["user_id"]
    subscriptions = db["push_subscriptions"].find({"user_id": user_id})

    if VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY:
        try:
            from pywebpush import webpush, WebPushException
            for sub in subscriptions:
                try:
                    webpush(
                        subscription_info={
                            "endpoint": sub["endpoint"],
                            "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}
                        },
                        data=json.dumps(alert_payload),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": VAPID_SUBJECT}
                    )
                except WebPushException as ex:
                    if ex.response and ex.response.status_code in (404, 410):
                        db["push_subscriptions"].delete_one({"_id": sub["_id"]})
        except Exception as e:
            print("WebPush error:", e)
