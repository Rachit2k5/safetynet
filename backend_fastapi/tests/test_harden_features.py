import pytest
from fastapi.testclient import TestClient
from app.main import app, db

client = TestClient(app)

def test_auth_register_and_login():
    email = "harden_user@example.com"
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
    assert res_login.json()["token"] == token

    # 3. Invalid Login
    res_bad = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword!"
    })
    assert res_bad.status_code == 401

def test_authorization_and_ownership_checks():
    # User 1
    res_u1 = client.post("/api/auth/register", json={
        "name": "User One", "email": "u1@example.com", "password": "Password123!"
    })
    t1 = res_u1.json()["token"]
    u1_id = res_u1.json()["id"]

    # User 2
    res_u2 = client.post("/api/auth/register", json={
        "name": "User Two", "email": "u2@example.com", "password": "Password123!"
    })
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
