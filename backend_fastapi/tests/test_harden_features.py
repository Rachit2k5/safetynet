import pytest
from fastapi.testclient import TestClient
from app.main import app, db

client = TestClient(app)

def test_auth_register_and_login():
    import uuid
    email = f"harden_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePassword123!"

    # 1. Register
    res_reg = client.post("/api/auth/register", json={
        "name": "Hardened User",
        "email": email,
        "password": password
    })
    assert res_reg.status_code == 201
    token = res_reg.json()["token"]
    assert token is not None

    # 2. Login
    res_login = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert res_login.status_code == 200
    assert "token" in res_login.json()
    assert res_login.json()["token"] is not None

    # 3. Invalid Login
    res_bad = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword!"
    })
    assert res_bad.status_code == 401

def test_authorization_and_ownership_checks():
    import uuid
    u1_email = f"u1_{uuid.uuid4().hex[:8]}@example.com"
    u2_email = f"u2_{uuid.uuid4().hex[:8]}@example.com"

    # User 1
    res_u1 = client.post("/api/auth/register", json={
        "name": "User One", "email": u1_email, "password": "Password123!"
    })
    assert res_u1.status_code == 201
    t1 = res_u1.json()["token"]
    u1_id = res_u1.json()["id"]

    # User 2
    res_u2 = client.post("/api/auth/register", json={
        "name": "User Two", "email": u2_email, "password": "Password123!"
    })
    assert res_u2.status_code == 201
    t2 = res_u2.json()["token"]
    u2_id = res_u2.json()["id"]

    # Contact added by User 1
    res_c = client.post(f"/api/users/{u1_id}/contacts", json={
        "name": "Mom", "email": "mom@example.com"
    }, headers={"Authorization": f"Bearer {t1}"})
    contact_id = res_c.json()["id"]

    # 1. Unauthorized check (No token) -> 401
    res_no_auth = client.get(f"/api/users/{u1_id}/contacts")
    assert res_no_auth.status_code == 401

    # 2. Forbidden check (User 2 trying to delete User 1's contact) -> 403
    res_forbidden = client.delete(f"/api/users/{u1_id}/contacts/{contact_id}", headers={"Authorization": f"Bearer {t2}"})
    assert res_forbidden.status_code == 403

def test_haversine_route_deviation_detection():
    # User 1 starts trip
    res_u = client.post("/api/users", json={"name": "Driver"})
    token = res_u.json()["sessionToken"]
    headers = {"Authorization": f"Bearer {token}"}

    res_t = client.post("/api/trips", json={
        "origin": "Point A", "destination": "Point B",
        "origin_lat": 28.6139, "origin_lng": 77.2090,
        "dest_lat": 28.6180, "dest_lng": 77.2150
    }, headers=headers)
    trip_id = res_t.json()["id"]

    # Move GPS location 5km off course
    res_loc = client.post(f"/api/trips/{trip_id}/location", json={
        "lat": 28.6600, "lng": 77.2600  # 5km+ away
    }, headers=headers)

    assert res_loc.status_code == 200
    dev = res_loc.json()["deviation"]
    assert dev["isDeviated"] == True
    assert dev["riskLevel"] == "HIGH"
    assert dev["flag"] == "CRITICAL_ROUTE_DEVIATION"

def test_sos_duplicate_prevention_and_pipeline():
    res_u = client.post("/api/users", json={"name": "Traveler SOS"})
    token = res_u.json()["sessionToken"]
    headers = {"Authorization": f"Bearer {token}"}

    res_t = client.post("/api/trips", json={"origin": "A", "destination": "B"}, headers=headers)
    trip_id = res_t.json()["id"]

    # 1. First Panic Call
    res_p1 = client.post(f"/api/trips/{trip_id}/panic", json={"lat": 28.6139, "lng": 77.2090}, headers=headers)
    assert res_p1.status_code == 200
    alert_id = res_p1.json()["alertId"]

    # 2. Immediate Second Panic Call (Duplicate within 60s)
    res_p2 = client.post(f"/api/trips/{trip_id}/panic", json={"lat": 28.6139, "lng": 77.2090}, headers=headers)
    assert res_p2.status_code == 200
    assert res_p2.json()["alertId"] == alert_id
    assert res_p2.json().get("isDuplicate") == True

def test_server_geocoding_police_stations_endpoint():
    res = client.get("/api/geocoding/police-stations?lat=28.6139&lng=77.2090")
    assert res.status_code == 200
    data = res.json()
    assert "policeStations" in data
    assert "policeStationsCount" in data

def test_parent_portal_auth_and_evidence_stream():
    import uuid
    email = f"child_{uuid.uuid4().hex[:8]}@example.com"
    # 1. Register child user
    res_reg = client.post("/api/auth/register", json={
        "name": "Child Traveler", "email": email, "password": "Password123!"
    })
    token = res_reg.json()["token"]
    user_id = res_reg.json()["id"]

    # 2. Parent Login with default PIN (1234) -> 200
    res_parent_init = client.post("/api/parent/login", json={"email": email, "pin": "1234"})
    assert res_parent_init.status_code == 200
    parent_token_init = res_parent_init.json()["parentToken"]

    # 3. Change Parent PIN from Parent Portal (e.g. 5678) using parent_token_init
    res_pin = client.put("/api/parent/pin", json={"pin": "5678"}, headers={"Authorization": f"Bearer {parent_token_init}"})
    assert res_pin.status_code == 200

    # 4. Parent Login with wrong PIN -> 401
    res_bad = client.post("/api/parent/login", json={"email": email, "pin": "9999"})
    assert res_bad.status_code == 401

    # 5. Parent Login with new PIN (5678) -> 200
    res_parent = client.post("/api/parent/login", json={"email": email, "pin": "5678"})
    assert res_parent.status_code == 200
    parent_token = res_parent.json()["parentToken"]

    # 6. Fetch Parent Dashboard Stream
    res_dash = client.get("/api/parent/dashboard", headers={"Authorization": f"Bearer {parent_token}"})
    assert res_dash.status_code == 200
    dash = res_dash.json()
    assert "child" in dash
    assert "evidenceVault" in dash
    assert dash["child"]["name"] == "Child Traveler"

