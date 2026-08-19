import uuid
import os
import time
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Dict

from app.db.mongodb import get_db
from app.db.seed import seed_db
from app.services.checkin_timer import checkin_timer
from app.services.scoring import score_route
from app.services.distress import analyze_message
from app.services.push import broadcast_alert

app = FastAPI(title="SafeRoute FastAPI Backend", version="1.0.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for audio/video evidence clips
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Active WebSocket connections dictionary: trip_id -> set of WebSockets
active_websockets: Dict[str, List[WebSocket]] = {}

# Seed DB on startup if empty
db = get_db()
if db["route_incidents"].count_documents({}) == 0:
    seed_db()

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.split(" ")[1]
    user = db["users"].find_one({"session_token": token})
    if not user:
        user = db["users"].find_one({"_id": token})
    if not user:
        user_id = token if len(token) > 10 else str(uuid.uuid4())
        user = {"_id": user_id, "name": "Traveler", "session_token": token, "created_at": datetime.now(timezone.utc).isoformat()}
        db["users"].insert_one(user)
    return user

# --- Pydantic Schemas ---
class UserCreate(BaseModel):
    name: str

class ContactCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = "+1234567890"

class TripCreate(BaseModel):
    origin: Optional[str] = "Current Location"
    destination: Optional[str] = "Destination"
    origin_lat: Optional[float] = 28.6139
    origin_lng: Optional[float] = 77.2090
    dest_lat: Optional[float] = 28.6180
    dest_lng: Optional[float] = 77.2150
    expected_arrival: Optional[str] = None
    checkin_interval_ms: Optional[int] = 900000

class CheckinPayload(BaseModel):
    status: Optional[str] = "safe"
    message: Optional[str] = "I am safe"
    lat: Optional[float] = 28.6139
    lng: Optional[float] = 77.2090

class PanicPayload(BaseModel):
    lat: Optional[float] = 28.6139
    lng: Optional[float] = 77.2090
    aiReport: Optional[str] = None

class EvidencePayload(BaseModel):
    audioData: Optional[str] = None
    imageData: Optional[str] = None
    shareToken: Optional[str] = None

class AcknowledgePayload(BaseModel):
    shareToken: str

class RouteScorePayload(BaseModel):
    hour: Optional[int] = None
    routes: List[dict]

# --- Startup Event ---
@app.on_event("startup")
async def startup_event():
    async def on_missed_cb(trip_id: str):
        alert_id = str(uuid.uuid4())
        alert_doc = {
            "_id": alert_id,
            "trip_id": trip_id,
            "type": "missed_checkin",
            "severity": "high",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        db["alerts"].insert_one(alert_doc)
        await broadcast_alert(active_websockets, trip_id, {"type": "missed_checkin", "alertId": alert_id})

    await checkin_timer.rehydrate_timers(db, on_missed_cb)

# --- REST Routes ---

@app.get("/api/health")
def health():
    return {"status": "ok", "backend": "FastAPI + MongoDB"}

# User Routes
@app.post("/api/users", status_code=201)
def create_user(payload: UserCreate):
    user_id = str(uuid.uuid4())
    session_token = str(uuid.uuid4())
    doc = {
        "_id": user_id,
        "name": payload.name.strip(),
        "session_token": session_token,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["users"].insert_one(doc)
    return {"id": user_id, "name": payload.name, "sessionToken": session_token}

@app.get("/api/users/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"id": user["_id"], "name": user["name"]}

# Contact Routes
@app.post("/api/users/{user_id}/contacts", status_code=201)
def add_contact(user_id: str, payload: ContactCreate, user: dict = Depends(get_current_user)):
    target_user_id = user["_id"]
    count = db["contacts"].count_documents({"user_id": target_user_id})
    if count >= 3:
        raise HTTPException(status_code=400, detail="Max 3 contacts allowed")
    
    cid = str(uuid.uuid4())
    phone_val = payload.phone if (payload.phone and payload.phone.strip()) else "+1234567890"
    doc = {
        "_id": cid,
        "user_id": target_user_id,
        "name": payload.name,
        "email": payload.email,
        "phone": phone_val,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["contacts"].insert_one(doc)
    return {"id": cid, "name": payload.name, "email": payload.email, "phone": phone_val}

@app.get("/api/users/{user_id}/contacts")
def list_contacts(user_id: str, user: dict = Depends(get_current_user)):
    target_user_id = user["_id"]
    contacts = list(db["contacts"].find({"user_id": target_user_id}))
    return [{"id": c["_id"], "name": c["name"], "email": c["email"], "phone": c.get("phone", "+1234567890")} for c in contacts]

@app.delete("/api/users/{user_id}/contacts/{contact_id}")
def delete_contact(user_id: str, contact_id: str, user: dict = Depends(get_current_user)):
    target_user_id = user["_id"]
    db["contacts"].delete_one({"_id": contact_id, "user_id": target_user_id})
    return {"success": True}

# Trip Routes
@app.get("/api/trips")
def get_user_trips(user: dict = Depends(get_current_user)):
    trips = db["trips"].find({"user_id": user["_id"]}, sort=[("started_at", -1)])
    return [{**t, "id": t["_id"]} for t in trips]

@app.post("/api/trips", status_code=201)
async def start_trip(payload: TripCreate, user: dict = Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    share_token = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    arrival = payload.expected_arrival or datetime.fromtimestamp(time.time() + 1800, timezone.utc).isoformat()

    doc = {
        "_id": trip_id,
        "user_id": user["_id"],
        "origin": payload.origin,
        "destination": payload.destination,
        "origin_lat": payload.origin_lat,
        "origin_lng": payload.origin_lng,
        "dest_lat": payload.dest_lat,
        "dest_lng": payload.dest_lng,
        "expected_arrival": arrival,
        "status": "active",
        "share_token": share_token,
        "checkin_interval_ms": payload.checkin_interval_ms,
        "started_at": now_iso
    }
    db["trips"].insert_one(doc)

    async def on_missed(t_id):
        alert_id = str(uuid.uuid4())
        db["alerts"].insert_one({
            "_id": alert_id, "trip_id": t_id, "type": "missed_checkin", "severity": "high", "created_at": datetime.now(timezone.utc).isoformat()
        })
        await broadcast_alert(active_websockets, t_id, {"type": "missed_checkin", "alertId": alert_id})

    checkin_timer.start_timer(trip_id, payload.checkin_interval_ms, 300000, on_missed)
    return {"id": trip_id, "shareToken": share_token}

@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str, user: dict = Depends(get_current_user)):
    trip = db["trips"].find_one({"_id": trip_id, "user_id": user["_id"]})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {**trip, "id": trip["_id"]}

@app.get("/api/users/{user_id}/sent_emails")
def get_sent_emails(user_id: str):
    emails = list(db["sent_emails"].find({}, sort=[("deliveredAt", -1)]))
    return [{**e, "id": str(e["_id"])} for e in emails]

@app.put("/api/trips/{trip_id}/checkin")
async def checkin(trip_id: str, payload: CheckinPayload, user: dict = Depends(get_current_user)):
    analysis = analyze_message(payload.message, payload.status)
    cid = str(uuid.uuid4())
    db["checkins"].insert_one({
        "_id": cid, "trip_id": trip_id, "type": "manual", "status": payload.status,
        "message": payload.message, "lat": payload.lat, "lng": payload.lng,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    checkin_timer.reset_timer(trip_id)

    if analysis["isDistressed"]:
        alert_id = str(uuid.uuid4())
        db["alerts"].insert_one({
            "_id": alert_id, "trip_id": trip_id, "type": "distress_message", "severity": "high",
            "lat": payload.lat, "lng": payload.lng, "created_at": datetime.now(timezone.utc).isoformat()
        })
        await broadcast_alert(active_websockets, trip_id, {"type": "distress_message", "alertId": alert_id, "lat": payload.lat, "lng": payload.lng})

    return {"success": True, "details": analysis["details"]}

from app.services.email_service import send_emergency_email

@app.api_route("/api/trips/{trip_id}/panic", methods=["POST", "PUT"])
async def panic(trip_id: str, payload: PanicPayload):
    trip = db["trips"].find_one({"_id": trip_id})
    db["trips"].update_one({"_id": trip_id}, {"$set": {"status": "panic"}})
    checkin_timer.clear_timer(trip_id)

    alert_id = str(uuid.uuid4())
    alert_doc = {
        "_id": alert_id, "trip_id": trip_id, "type": "panic", "severity": "critical",
        "lat": payload.lat, "lng": payload.lng, "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["alerts"].insert_one(alert_doc)

    emails_sent = 0
    if trip and trip.get("user_id"):
        user = db["users"].find_one({"_id": trip["user_id"]})
        contacts = list(db["contacts"].find({"user_id": trip["user_id"]}))
        traveler_name = user.get("name", "Traveler") if user else "Traveler"
        share_token = trip.get("share_token", "")

        checkins = list(db["checkins"].find({"trip_id": trip_id}))
        latest_checkin = checkins[-1] if checkins else None
        spoken_transcript = latest_checkin.get("message") if latest_checkin else "Emergency Panic Button Pressed"

        smtp_config = user.get("smtp_config") if user else None

        for c in contacts:
            if c.get("email"):
                email_res = send_emergency_email(
                    to_email=c["email"],
                    contact_name=c["name"],
                    traveler_name=traveler_name,
                    trip_id=trip_id,
                    share_token=share_token,
                    lat=payload.lat,
                    lng=payload.lng,
                    spoken_transcript=payload.aiReport or spoken_transcript,
                    smtp_config=smtp_config
                )
                db["sent_emails"].insert_one(email_res)
                emails_sent += 1

    await broadcast_alert(active_websockets, trip_id, {"type": "panic", "alertId": alert_id, "lat": payload.lat, "lng": payload.lng})
    return {"success": True, "alertId": alert_id, "emailsSent": emails_sent}

@app.put("/api/trips/{trip_id}/complete")
def complete_trip(trip_id: str, user: dict = Depends(get_current_user)):
    expires_at = datetime.fromtimestamp(time.time() + 86400, timezone.utc).isoformat()
    db["trips"].update_one({"_id": trip_id, "user_id": user["_id"]}, {"$set": {
        "status": "completed", "ended_at": datetime.now(timezone.utc).isoformat(), "share_token_expires_at": expires_at
    }})
    checkin_timer.clear_timer(trip_id)
    return {"success": True}

@app.get("/api/trips/{trip_id}/status/{share_token}")
def get_contact_status(trip_id: str, share_token: str):
    trip = db["trips"].find_one({"_id": trip_id, "share_token": share_token})
    if not trip:
        raise HTTPException(status_code=404, detail="Not found")

    if trip.get("share_token_expires_at"):
        try:
            exp_dt = datetime.fromisoformat(trip["share_token_expires_at"].replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Link expired")
        except Exception:
            pass

    user = db["users"].find_one({"_id": trip["user_id"]})
    checkins = db["checkins"].find({"trip_id": trip_id}, sort=[("created_at", -1)], limit=1)
    alerts = db["alerts"].find({"trip_id": trip_id}, sort=[("created_at", -1)])

    latest_checkin = checkins[0] if checkins else None
    alerts_list = [{**a, "id": a["_id"]} for a in alerts]

    return {
        "id": trip["_id"],
        "origin": trip["origin"],
        "destination": trip["destination"],
        "status": trip["status"],
        "expected_arrival": trip["expected_arrival"],
        "user": {"name": user["name"]} if user else {"name": "Traveler"},
        "latestCheckin": latest_checkin,
        "alerts": alerts_list
    }

class EvidencePayload(BaseModel):
    audioData: Optional[str] = None
    imageData: Optional[str] = None
    videoData: Optional[str] = None
    shareToken: Optional[str] = None

# Alert Evidence Upload (Audio + Camera Snapshot Photo + Video Clip)
@app.post("/api/alerts/{alert_id}/evidence")
async def upload_evidence(alert_id: str, payload: EvidencePayload):
    alert = db["alerts"].find_one({"_id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    import base64, re
    update_fields = {}

    if payload.imageData:
        try:
            img_clean = payload.imageData.split(",", 1)[1] if "," in payload.imageData else payload.imageData
            img_clean += '=' * (-len(img_clean) % 4)
            img_name = f"photo_{alert_id}_{int(time.time())}.jpg"
            img_path = os.path.join("uploads", img_name)
            with open(img_path, "wb") as f:
                f.write(base64.b64decode(img_clean))
            update_fields["photo_url"] = f"/uploads/{img_name}"
        except Exception as e:
            print(f"[WARN] Base64 image decode error: {e}")

    if payload.audioData:
        try:
            aud_clean = payload.audioData.split(",", 1)[1] if "," in payload.audioData else payload.audioData
            aud_clean += '=' * (-len(aud_clean) % 4)
            aud_name = f"evidence_{alert_id}_{int(time.time())}.webm"
            aud_path = os.path.join("uploads", aud_name)
            with open(aud_path, "wb") as f:
                f.write(base64.b64decode(aud_clean))
            update_fields["evidence_url"] = f"/uploads/{aud_name}"
        except Exception as e:
            print(f"[WARN] Base64 audio decode error: {e}")

    if payload.videoData:
        try:
            vid_clean = payload.videoData.split(",", 1)[1] if "," in payload.videoData else payload.videoData
            vid_clean += '=' * (-len(vid_clean) % 4)
            vid_name = f"video_{alert_id}_{int(time.time())}.webm"
            vid_path = os.path.join("uploads", vid_name)
            with open(vid_path, "wb") as f:
                f.write(base64.b64decode(vid_clean))
            update_fields["video_url"] = f"/uploads/{vid_name}"
        except Exception as e:
            print(f"[WARN] Base64 video decode error: {e}")

    if update_fields:
        db["alerts"].update_one({"_id": alert_id}, {"$set": update_fields})

    # Dispatch email with photo, audio & video evidence link to trusted contacts
    trip_id = alert.get("trip_id")
    trip = db["trips"].find_one({"_id": trip_id}) if trip_id else None
    user_id = trip.get("user_id") if trip else None

    # Fallback to latest active user if trip user is not bound
    if not user_id:
        users = list(db["users"].find({}, sort=[("created_at", -1)], limit=1))
        if users:
            user_id = users[0]["_id"]

    if user_id:
        user = db["users"].find_one({"_id": user_id})
        contacts = list(db["contacts"].find({"user_id": user_id}))
        traveler_name = user.get("name", "Traveler") if user else "Traveler"
        share_token = trip.get("share_token", "") if trip else ""
        checkins = list(db["checkins"].find({"trip_id": trip_id})) if trip_id else []
        checkin_messages = [c.get("message", "") for c in checkins if c.get("message")]
        spoken_transcript = "\n".join(checkin_messages) if checkin_messages else "Emergency Photo, Audio & Video Evidence Captured"

        smtp_config = user.get("smtp_config") if user else None

        for c in contacts:
            if c.get("email"):
                email_res = send_emergency_email(
                    to_email=c["email"],
                    contact_name=c["name"],
                    traveler_name=traveler_name,
                    trip_id=trip_id or "emergency",
                    share_token=share_token,
                    lat=alert.get("lat", 28.6139),
                    lng=alert.get("lng", 77.2090),
                    spoken_transcript=spoken_transcript,
                    photo_url=update_fields.get("photo_url") or alert.get("photo_url"),
                    evidence_url=update_fields.get("evidence_url") or alert.get("evidence_url"),
                    video_url=update_fields.get("video_url") or alert.get("video_url"),
                    smtp_config=smtp_config
                )
                db["sent_emails"].insert_one(email_res)

    # Broadcast evidence update over WebSocket
    room_sockets = active_websockets.get(trip_id, [])
    for ws in list(room_sockets):
        try:
            await ws.send_json({
                "type": "alert:evidence", 
                "alertId": alert_id, 
                "evidenceUrl": update_fields.get("evidence_url") or alert.get("evidence_url"),
                "photoUrl": update_fields.get("photo_url") or alert.get("photo_url")
            })
        except Exception:
            pass

    return {"success": True, **update_fields}

# Route Risk Scoring
@app.post("/api/routes/score")
def score_routes(payload: RouteScorePayload, user: dict = Depends(get_current_user)):
    current_hour = payload.hour if payload.hour is not None else datetime.now().hour
    results = []
    for r in payload.routes:
        score_data = score_route(db, r.get("waypoints", []), current_hour)
        results.append({"name": r.get("name"), "scoreData": score_data})
    return results

# --- WebSocket Handler ---
@app.websocket("/ws/trips/{trip_id}")
async def websocket_endpoint(websocket: WebSocket, trip_id: str):
    await websocket.accept()
    if trip_id not in active_websockets:
        active_websockets[trip_id] = []
    active_websockets[trip_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast location updates
            if data.get("type") == "location:send":
                for ws in list(active_websockets[trip_id]):
                    if ws != websocket:
                        await ws.send_json({"type": "location:update", "data": data.get("data")})
    except WebSocketDisconnect:
        active_websockets[trip_id].remove(websocket)
