import uuid
from app.db.mongodb import get_db

def seed_db():
    db = get_db()
    
    # Clear existing
    incidents_col = db["route_incidents"]
    lighting_col = db["route_lighting"]
    
    incidents = [
        {"_id": str(uuid.uuid4()), "lat": 28.6140, "lng": 77.2095, "type": "mugging", "severity": "high", "time_of_day": "night", "description": "Attempted robbery near park line"},
        {"_id": str(uuid.uuid4()), "lat": 28.6145, "lng": 77.2098, "type": "poor_visibility", "severity": "medium", "time_of_day": "night", "description": "Broken street lights for 200m"},
        {"_id": str(uuid.uuid4()), "lat": 28.6150, "lng": 77.2105, "type": "harassment", "severity": "high", "time_of_day": "late_night", "description": "Reported stalking incident"},
        {"_id": str(uuid.uuid4()), "lat": 28.6160, "lng": 77.2120, "type": "theft", "severity": "low", "time_of_day": "evening", "description": "Pickpocketing near market exit"}
    ]
    
    lighting = [
        {"_id": str(uuid.uuid4()), "lat": 28.6139, "lng": 77.2090, "coverage_score": 0.9, "time_of_day": "night"},
        {"_id": str(uuid.uuid4()), "lat": 28.6140, "lng": 77.2095, "coverage_score": 0.2, "time_of_day": "night"},
        {"_id": str(uuid.uuid4()), "lat": 28.6150, "lng": 77.2110, "coverage_score": 0.8, "time_of_day": "night"},
        {"_id": str(uuid.uuid4()), "lat": 28.6160, "lng": 77.2120, "coverage_score": 0.4, "time_of_day": "night"}
    ]
    
    for inc in incidents:
        incidents_col.insert_one(inc)
    for lgt in lighting:
        lighting_col.insert_one(lgt)
        
    print(f"[INFO] Seeded MongoDB with {len(incidents)} incidents and {len(lighting)} lighting data points.")

if __name__ == "__main__":
    seed_db()
