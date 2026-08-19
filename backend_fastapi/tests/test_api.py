import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert "FastAPI" in res.json()["backend"]

def test_user_creation_and_profile():
    # 1. Create User
    res = client.post("/api/users", json={"name": "Test Traveler"})
    assert res.status_code == 201
    data = res.json()
    assert "id" in data
    assert "sessionToken" in data
    token = data["sessionToken"]
    user_id = data["id"]

    # 2. Get Me
    headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/api/users/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["name"] == "Test Traveler"

    # 3. Add Contact
    res_c = client.post(f"/api/users/{user_id}/contacts", json={
        "name": "Contact One", "email": "c1@example.com", "phone": "+12345"
    }, headers=headers)
    assert res_c.status_code == 201

    # 4. List Contacts
    res_c_list = client.get(f"/api/users/{user_id}/contacts", headers=headers)
    assert res_c_list.status_code == 200
    assert len(res_c_list.json()) == 1

def test_trip_checkin_and_panic():
    # Create user
    res_u = client.post("/api/users", json={"name": "Alice"})
    token = res_u.json()["sessionToken"]
    headers = {"Authorization": f"Bearer {token}"}

    # Start Trip
    res_t = client.post("/api/trips", json={
        "origin": "Library",
        "destination": "Hostel",
        "checkin_interval_ms": 60000
    }, headers=headers)
    assert res_t.status_code == 201
    trip = res_t.json()
    trip_id = trip["id"]
    share_token = trip["shareToken"]

    # Checkin with distress message
    res_chk = client.put(f"/api/trips/{trip_id}/checkin", json={
        "status": "safe",
        "message": "I am safe but someone is following me",
        "lat": 28.6140, "lng": 77.2095
    }, headers=headers)
    assert res_chk.status_code == 200
    assert res_chk.json()["details"]["contradictionFlag"] == True

    # Contact Status View
    res_status = client.get(f"/api/trips/{trip_id}/status/{share_token}")
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "active"
    assert len(res_status.json()["alerts"]) >= 1

    # Panic
    res_panic = client.put(f"/api/trips/{trip_id}/panic", json={"lat": 28.6150, "lng": 77.2100}, headers=headers)
    assert res_panic.status_code == 200
    assert "alertId" in res_panic.json()

def test_risk_scoring():
    res_u = client.post("/api/users", json={"name": "Bob"})
    token = res_u.json()["sessionToken"]
    headers = {"Authorization": f"Bearer {token}"}

    res_score = client.post("/api/routes/score", json={
        "hour": 2,
        "routes": [
            {"name": "Night Route", "waypoints": [{"lat": 28.6139, "lng": 77.2090}]}
        ]
    }, headers=headers)
    assert res_score.status_code == 200
    scores = res_score.json()
    assert len(scores) == 1
    assert "totalScore" in scores[0]["scoreData"]
