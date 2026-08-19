def score_route(db, waypoints, hour: int):
    if not waypoints:
        return {
            "totalScore": 0.0,
            "breakdown": {"incidentDensity": 0.0, "lightingCoverage": 0.0, "timeOfDayFactor": 0.0, "footTrafficInverse": 0.0},
            "recommendation": "safe"
        }

    total_incidents = 0
    total_lighting_score = 0.0
    lighting_points = 0

    incidents_list = db["route_incidents"].find()
    lighting_list = db["route_lighting"].find()

    for wp in waypoints:
        w_lat, w_lng = wp["lat"], wp["lng"]
        for inc in incidents_list:
            if abs(inc["lat"] - w_lat) < 0.005 and abs(inc["lng"] - w_lng) < 0.005:
                total_incidents += 1

        for lgt in lighting_list:
            if abs(lgt["lat"] - w_lat) < 0.005 and abs(lgt["lng"] - w_lng) < 0.005:
                total_lighting_score += lgt.get("coverage_score", 0.5)
                lighting_points += 1

    incident_density = min(total_incidents / 10.0, 1.0)
    lighting_coverage = (total_lighting_score / lighting_points) if lighting_points > 0 else 0.0

    time_of_day_factor = 0.0
    if hour >= 18 or hour < 6:
        off = (hour - 18) if hour >= 18 else (hour + 6)
        time_of_day_factor = (off / 8.0) if off <= 8 else (1.0 - ((off - 8.0) / 4.0))

    foot_traffic_inverse = 0.8 if (hour >= 22 or hour <= 5) else 0.2

    total_score = (0.35 * incident_density) + (0.25 * (1.0 - lighting_coverage)) + (0.25 * time_of_day_factor) + (0.15 * foot_traffic_inverse)

    recommendation = "safe"
    if total_score > 0.7:
        recommendation = "high_risk"
    elif total_score > 0.4:
        recommendation = "caution"

    return {
        "totalScore": total_score,
        "breakdown": {
            "incidentDensity": incident_density,
            "lightingCoverage": lighting_coverage,
            "timeOfDayFactor": time_of_day_factor,
            "footTrafficInverse": foot_traffic_inverse
        },
        "recommendation": recommendation
    }
