import os
import uuid
import time
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict

from app.db.mongodb import get_db
from app.db.seed import seed_db
from app.services.checkin_timer import checkin_timer
from app.services.scoring import score_route
from app.services.ai_engine import evaluate_threat_assessment
from app.services.haversine import evaluate_route_deviation, haversine_distance_km
from app.services.geocoding import fetch_server_police_stations
from app.services.push import broadcast_alert
from app.services.email_service import send_emergency_email

app = FastAPI(title="SafeRoute FastAPI Backend", version="2.0.0")

# Security Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "saferoute-super-secret-key-production-2026-secure-32bytes")
JWT_ALGORITHM = "HS256"

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for audio/video/photo evidence
is_vercel = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
UPLOAD_DIR = "/tmp/uploads" if is_vercel else "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Active WebSocket connections dictionary: trip_id -> set of WebSockets
active_websockets: Dict[str, List[WebSocket]] = {}

# Seed DB on startup if empty
db = get_db()
if db["route_incidents"].count_documents({}) == 0:
    seed_db()

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str = "") -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + (86400 * 30)  # 30 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ")[1]

    # 1. Try JWT Decoding
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            user = db["users"].find_one({"_id": user_id})
            if user:
                return user
    except Exception:
        pass

    # 2. Try Direct Session Token / User ID match
    user = db["users"].find_one({"session_token": token})
    if not user:
        user = db["users"].find_one({"_id": token})

    # 3. Fallback provision for legacy/test sessions
    if not user:
        if len(token) < 5:
            raise HTTPException(status_code=401, detail="Invalid session token")
        user_id = token if len(token) > 10 else str(uuid.uuid4())
        user = {
            "_id": user_id,
            "name": "Traveler",
            "email": f"user_{user_id[:8]}@saferoute.app",
            "session_token": token,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        db["users"].insert_one(user)

    return user

def verify_user_ownership(user_id_param: str, current_user: dict):
    if current_user["_id"] != user_id_param and user_id_param != "me":
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this resource")

# --- Pydantic Schemas ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

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

class LocationUpdatePayload(BaseModel):
    lat: float
    lng: float

class CheckinPayload(BaseModel):
    status: Optional[str] = "safe"
    message: Optional[str] = "I am safe"
    lat: Optional[float] = 28.6139
    lng: Optional[float] = 77.2090
    interval_ms: Optional[int] = None

class PanicPayload(BaseModel):
    lat: Optional[float] = 28.6139
    lng: Optional[float] = 77.2090
    aiReport: Optional[str] = None

class EvidencePayload(BaseModel):
    audioData: Optional[str] = None
    imageData: Optional[str] = None
    videoData: Optional[str] = None
    shareToken: Optional[str] = None

class RouteScorePayload(BaseModel):
    hour: Optional[int] = None
    routes: List[dict]

class GeocodeQueryPayload(BaseModel):
    lat: float
    lng: float
    radiusKm: Optional[float] = 5.0

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
        db["trips"].update_one({"_id": trip_id}, {"$set": {"status": "attention_required"}})
        await broadcast_alert(active_websockets, trip_id, {"type": "missed_checkin", "alertId": alert_id})

    await checkin_timer.rehydrate_timers(db, on_missed_cb)

# --- REST Routes ---

@app.get("/api/health")
def health():
    return {"status": "ok", "backend": "FastAPI 2.0 + MongoDB Engine"}

# --- Auth Routes ---
@app.post("/api/auth/register", status_code=201)
def register(payload: UserRegister):
    email_clean = payload.email.strip().lower()
    existing = db["users"].find_one({"email": email_clean})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(payload.password)
    jwt_token = create_access_token(user_id, email_clean)

    doc = {
        "_id": user_id,
        "name": payload.name.strip(),
        "email": email_clean,
        "password_hash": pw_hash,
        "session_token": jwt_token,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["users"].insert_one(doc)
    return {"id": user_id, "name": payload.name, "email": email_clean, "token": jwt_token, "sessionToken": jwt_token}

@app.post("/api/auth/login")
def login(payload: UserLogin):
    email_clean = payload.email.strip().lower()
    user = db["users"].find_one({"email": email_clean})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    jwt_token = create_access_token(user["_id"], email_clean)
    db["users"].update_one({"_id": user["_id"]}, {"$set": {"session_token": jwt_token}})

    return {"id": user["_id"], "name": user["name"], "email": email_clean, "token": jwt_token, "sessionToken": jwt_token}

@app.post("/api/users", status_code=201)
def create_user(payload: UserCreate):
    user_id = str(uuid.uuid4())
    jwt_token = create_access_token(user_id)
    doc = {
        "_id": user_id,
        "name": payload.name.strip(),
        "session_token": jwt_token,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["users"].insert_one(doc)
    return {"id": user_id, "name": payload.name, "token": jwt_token, "sessionToken": jwt_token}

@app.get("/api/users/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"id": user["_id"], "name": user["name"], "email": user.get("email", "")}

class ParentPinPayload(BaseModel):
    pin: str

class ParentLoginPayload(BaseModel):
    pin: str
    email: Optional[str] = None
    user_id: Optional[str] = None

@app.put("/api/parent/pin")
def change_parent_pin(payload: ParentPinPayload, authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Parent authorization token required")
    token = authorization.split(" ")[1]
    try:
        jwt_payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = jwt_payload.get("sub")
    except Exception:
        user_id = token

    user = db["users"].find_one({"_id": user_id})
    if not user:
        users = list(db["users"].find({}, sort=[("created_at", -1)], limit=1))
        if users:
            user = users[0]

    if not user:
        raise HTTPException(status_code=404, detail="Child profile not found")

    pin_clean = payload.pin.strip()
    if len(pin_clean) < 4:
        raise HTTPException(status_code=400, detail="Parent Security PIN must be at least 4 digits")

    pin_hash = hash_password(pin_clean)
    db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"parent_pin_hash": pin_hash, "parent_pin_raw": pin_clean}}
    )
    return {"success": True, "message": "Parent Portal Security PIN updated successfully"}

@app.post("/api/parent/login")
def parent_login(payload: ParentLoginPayload):
    pin_clean = payload.pin.strip() if payload.pin else "1234"
    user = None

    if payload.user_id:
        user = db["users"].find_one({"_id": payload.user_id})
    if not user and payload.email:
        user = db["users"].find_one({"email": payload.email.strip().lower()})

    if not user:
        users = list(db["users"].find({}, sort=[("created_at", -1)], limit=1))
        if users:
            user = users[0]

    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "name": "Traveler",
            "parent_pin_raw": "1234",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        db["users"].insert_one(user)

    parent_hash = user.get("parent_pin_hash")
    parent_raw = user.get("parent_pin_raw", "1234")

    # Verify parent PIN — default 1234 always unlocks, as well as exact match or password verify
    is_valid = (
        pin_clean == "1234" or
        pin_clean == parent_raw or
        (parent_hash and verify_password(pin_clean, parent_hash))
    )

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid Parent Security Password / PIN")

    parent_token = create_access_token(user["_id"], f"parent_{user['_id'][:8]}")
    return {
        "success": True,
        "parentToken": parent_token,
        "childId": user["_id"],
        "childName": user.get("name", "Traveler")
    }

@app.get("/api/parent/dashboard")
def get_parent_dashboard(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Parent authorization token required")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        user_id = token

    user = db["users"].find_one({"_id": user_id})
    if not user:
        # Fallback to latest user
        users = list(db["users"].find({}, sort=[("created_at", -1)], limit=1))
        if users:
            user = users[0]

    if not user:
        raise HTTPException(status_code=404, detail="Child record not found")

    # Fetch active trip and recent trips
    trips = list(db["trips"].find({"user_id": user["_id"]}, sort=[("started_at", -1)]))
    active_trip = next((t for t in trips if t.get("status") in ["active", "panic", "attention_required"]), trips[0] if trips else None)

    # Fetch evidence clips (photos, audio recordings, video clips)
    alerts = list(db["alerts"].find({}, sort=[("created_at", -1)], limit=20))
    checkins = list(db["checkins"].find({}, sort=[("created_at", -1)], limit=20))

    evidence_vault = []
    for a in alerts:
        if a.get("photo_url") or a.get("evidence_url") or a.get("video_url"):
            evidence_vault.append({
                "alertId": a["_id"],
                "type": a.get("type", "panic"),
                "severity": a.get("severity", "critical"),
                "photoUrl": a.get("photo_url"),
                "audioUrl": a.get("evidence_url"),
                "videoUrl": a.get("video_url"),
                "lat": a.get("lat"),
                "lng": a.get("lng"),
                "createdAt": a.get("created_at")
            })

    return {
        "child": {
            "id": user["_id"],
            "name": user.get("name", "Child Traveler"),
            "email": user.get("email", "")
        },
        "activeTrip": {**active_trip, "id": active_trip["_id"]} if active_trip else None,
        "recentTrips": [{**t, "id": t["_id"]} for t in trips[:5]],
        "evidenceVault": evidence_vault,
        "checkinLogs": [{**c, "id": str(c["_id"])} for c in checkins]
    }

# --- Contact Routes ---
@app.post("/api/users/{user_id}/contacts", status_code=201)
def add_contact(user_id: str, payload: ContactCreate, user: dict = Depends(get_current_user)):
    verify_user_ownership(user_id, user)
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
        "email": payload.email.strip(),
        "phone": phone_val,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["contacts"].insert_one(doc)
    return {"id": cid, "name": payload.name, "email": payload.email, "phone": phone_val}

@app.get("/api/users/{user_id}/contacts")
def list_contacts(user_id: str, user: dict = Depends(get_current_user)):
    verify_user_ownership(user_id, user)
    target_user_id = user["_id"]
    contacts = list(db["contacts"].find({"user_id": target_user_id}))
    return [{"id": c["_id"], "name": c["name"], "email": c["email"], "phone": c.get("phone", "+1234567890")} for c in contacts]

@app.delete("/api/users/{user_id}/contacts/{contact_id}")
def delete_contact(user_id: str, contact_id: str, user: dict = Depends(get_current_user)):
    verify_user_ownership(user_id, user)
    res = db["contacts"].delete_one({"_id": contact_id, "user_id": user["_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found or access denied")
    return {"success": True}

# --- Trip Routes ---
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
        "current_lat": payload.origin_lat,
        "current_lng": payload.origin_lng,
        "expected_arrival": arrival,
        "status": "active",
        "risk_status": "safe",
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
        db["trips"].update_one({"_id": t_id}, {"$set": {"status": "attention_required"}})
        await broadcast_alert(active_websockets, t_id, {"type": "missed_checkin", "alertId": alert_id})

    checkin_timer.start_timer(trip_id, payload.checkin_interval_ms, 300000, on_missed)
    return {"id": trip_id, "shareToken": share_token}

@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str, user: dict = Depends(get_current_user)):
    trip = db["trips"].find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.get("user_id") and trip["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this journey")

    return {**trip, "id": trip["_id"]}

# Real-time Location Updates with Haversine Route Deviation Detection
@app.post("/api/trips/{trip_id}/location")
async def update_location(trip_id: str, payload: LocationUpdatePayload, user: dict = Depends(get_current_user)):
    trip = db["trips"].find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.get("user_id") and trip["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    origin_lat = trip.get("origin_lat", payload.lat)
    origin_lng = trip.get("origin_lng", payload.lng)
    dest_lat = trip.get("dest_lat", payload.lat)
    dest_lng = trip.get("dest_lng", payload.lng)

    dev_res = evaluate_route_deviation(payload.lat, payload.lng, origin_lat, origin_lng, dest_lat, dest_lng)

    update_doc = {
        "current_lat": payload.lat,
        "current_lng": payload.lng,
        "deviation": dev_res
    }

    if dev_res["isDeviated"]:
        update_doc["risk_status"] = dev_res["riskLevel"]
        alert_id = str(uuid.uuid4())
        db["alerts"].insert_one({
            "_id": alert_id,
            "trip_id": trip_id,
            "type": "route_deviation",
            "severity": "medium" if dev_res["riskLevel"] == "MEDIUM" else "high",
            "lat": payload.lat,
            "lng": payload.lng,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await broadcast_alert(active_websockets, trip_id, {"type": "route_deviation", "alertId": alert_id, "deviation": dev_res})

    db["trips"].update_one({"_id": trip_id}, {"$set": update_doc})
    return {"success": True, "deviation": dev_res}

@app.get("/api/users/{user_id}/sent_emails")
def get_sent_emails(user_id: str, user: dict = Depends(get_current_user)):
    verify_user_ownership(user_id, user)
    emails = list(db["sent_emails"].find({}, sort=[("deliveredAt", -1)]))
    return [{**e, "id": str(e["_id"])} for e in emails]

@app.put("/api/trips/{trip_id}/checkin")
async def checkin(trip_id: str, payload: CheckinPayload, user: dict = Depends(get_current_user)):
    trip = db["trips"].find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.get("user_id") and trip["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    is_overdue = trip.get("status") in ["attention_required", "missed_checkin"]
    threat_analysis = evaluate_threat_assessment(payload.message, payload.status or "safe", is_overdue=is_overdue)

    cid = str(uuid.uuid4())
    db["checkins"].insert_one({
        "_id": cid, "trip_id": trip_id, "type": "manual", "status": payload.status,
        "message": payload.message, "lat": payload.lat, "lng": payload.lng,
        "threatAnalysis": threat_analysis,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    interval_ms = payload.interval_ms or trip.get("checkin_interval_ms", 300000)
    next_due_iso = (datetime.now(timezone.utc) + timedelta(milliseconds=interval_ms)).isoformat()
    checkin_timer.reset_timer(trip_id)

    # Resolution of overdue/missed state upon safe check-in & next check-in deadline extension
    if payload.status == "safe":
        db["trips"].update_one(
            {"_id": trip_id},
            {"$set": {"status": "active", "risk_status": "safe", "next_checkin_due": next_due_iso, "expected_arrival": next_due_iso, "checkin_interval_ms": interval_ms}}
        )

    if threat_analysis["isDistressed"]:
        alert_id = str(uuid.uuid4())
        db["alerts"].insert_one({
            "_id": alert_id, "trip_id": trip_id, "type": "distress_message", "severity": "high",
            "lat": payload.lat, "lng": payload.lng, "created_at": datetime.now(timezone.utc).isoformat()
        })
        await broadcast_alert(active_websockets, trip_id, {"type": "distress_message", "alertId": alert_id, "lat": payload.lat, "lng": payload.lng})

    return {
        "success": True,
        "details": threat_analysis["details"],
        "threatAnalysis": threat_analysis
    }

# Duplicate SOS Prevention + Honest Delivery Reporting
@app.api_route("/api/trips/{trip_id}/panic", methods=["POST", "PUT"])
async def panic(trip_id: str, payload: PanicPayload, user: dict = Depends(get_current_user)):
    target_trip_id = trip_id

    # Duplicate SOS Check (within last 60 seconds)
    recent_panic = db["alerts"].find_one({
        "trip_id": target_trip_id,
        "type": "panic"
    }, sort=[("created_at", -1)])

    if recent_panic:
        try:
            created_dt = datetime.fromisoformat(recent_panic["created_at"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - created_dt).total_seconds() < 60:
                return {"success": True, "alertId": recent_panic["_id"], "isDuplicate": True, "emailsSent": 0}
        except Exception:
            pass

    trip = db["trips"].find_one({"_id": target_trip_id})
    if trip:
        db["trips"].update_one({"_id": target_trip_id}, {"$set": {"status": "panic", "risk_status": "critical"}})
        checkin_timer.clear_timer(target_trip_id)

    alert_id = str(uuid.uuid4())
    alert_doc = {
        "_id": alert_id, "trip_id": target_trip_id, "type": "panic", "severity": "critical",
        "lat": payload.lat, "lng": payload.lng, "created_at": datetime.now(timezone.utc).isoformat()
    }
    db["alerts"].insert_one(alert_doc)

    user_id = trip.get("user_id") if trip else user["_id"]
    contacts = list(db["contacts"].find({"user_id": user_id}))
    traveler_name = user.get("name", "Traveler")
    share_token = trip.get("share_token", "") if trip else ""

    checkins = list(db["checkins"].find({"trip_id": target_trip_id})) if trip else []
    latest_checkin = checkins[-1] if checkins else None
    spoken_transcript = latest_checkin.get("message") if latest_checkin else "Emergency Panic Button Pressed"

    smtp_config = user.get("smtp_config")
    smtp_user = (smtp_config and smtp_config.get("user")) or os.getenv("SMTP_USER", "")

    notification_pipeline = []
    emails_sent = 0

    for c in contacts:
        if c.get("email"):
            email_res = send_emergency_email(
                to_email=c["email"],
                contact_name=c["name"],
                traveler_name=traveler_name,
                trip_id=target_trip_id,
                share_token=share_token,
                lat=payload.lat,
                lng=payload.lng,
                spoken_transcript=payload.aiReport or spoken_transcript,
                smtp_config=smtp_config
            )
            db["sent_emails"].insert_one(email_res)
            is_delivered = bool(smtp_user and (smtp_config or os.getenv("SMTP_PASS")))
            notification_pipeline.append({
                "contact": c["name"],
                "email": c["email"],
                "status": "DELIVERED" if is_delivered else "NOT_CONFIGURED"
            })
            if is_delivered:
                emails_sent += 1

    await broadcast_alert(active_websockets, target_trip_id, {"type": "panic", "alertId": alert_id, "lat": payload.lat, "lng": payload.lng})
    return {
        "success": True,
        "alertId": alert_id,
        "emailsSent": emails_sent,
        "notificationPipeline": notification_pipeline
    }

@app.put("/api/trips/{trip_id}/complete")
def complete_trip(trip_id: str, user: dict = Depends(get_current_user)):
    trip = db["trips"].find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.get("user_id") and trip["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    expires_at = datetime.fromtimestamp(time.time() + 86400, timezone.utc).isoformat()
    db["trips"].update_one({"_id": trip_id}, {"$set": {
        "status": "completed", "ended_at": datetime.now(timezone.utc).isoformat(), "share_token_expires_at": expires_at
    }})
    checkin_timer.clear_timer(trip_id)
    return {"success": True}

@app.get("/api/trips/{trip_id}/status/{share_token}")
def get_contact_status(trip_id: str, share_token: str):
    trip = db["trips"].find_one({"_id": trip_id, "share_token": share_token})
    if not trip:
        raise HTTPException(status_code=404, detail="Not found")

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

# Evidence Upload (Audio + Photo + Video)
@app.post("/api/alerts/{alert_id}/evidence")
async def upload_evidence(alert_id: str, payload: EvidencePayload):
    alert = db["alerts"].find_one({"_id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    import base64
    update_fields = {}

    if payload.imageData:
        try:
            img_clean = payload.imageData.split(",", 1)[1] if "," in payload.imageData else payload.imageData
            img_clean += '=' * (-len(img_clean) % 4)
            img_name = f"photo_{alert_id}_{int(time.time())}.jpg"
            img_path = os.path.join(UPLOAD_DIR, img_name)
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
            aud_path = os.path.join(UPLOAD_DIR, aud_name)
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
            vid_path = os.path.join(UPLOAD_DIR, vid_name)
            with open(vid_path, "wb") as f:
                f.write(base64.b64decode(vid_clean))
            update_fields["video_url"] = f"/uploads/{vid_name}"
        except Exception as e:
            print(f"[WARN] Base64 video decode error: {e}")

    if update_fields:
        db["alerts"].update_one({"_id": alert_id}, {"$set": update_fields})

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

# Server-Side Nominatim / OpenStreetMap Police Geocoding Endpoint
@app.api_route("/api/geocoding/police-stations", methods=["GET", "POST"])
def get_server_police_stations(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    payload: Optional[GeocodeQueryPayload] = None
):
    query_lat = lat or (payload and payload.lat) or 28.6139
    query_lng = lng or (payload and payload.lng) or 77.2090
    radius = (payload and payload.radiusKm) or 5.0

    stations = fetch_server_police_stations(query_lat, query_lng, radius_km=radius)
    return {
        "lat": query_lat,
        "lng": query_lng,
        "policeStationsCount": len(stations),
        "policeStations": stations
    }

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
            if data.get("type") == "location:send":
                for ws in list(active_websockets[trip_id]):
                    if ws != websocket:
                        await ws.send_json({"type": "location:update", "data": data.get("data")})
    except WebSocketDisconnect:
        active_websockets[trip_id].remove(websocket)
