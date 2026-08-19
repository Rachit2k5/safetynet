import math

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth's radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def distance_to_segment_km(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    """Calculate perpendicular distance in km from point P(px, py) to line segment AB(ax,ay -> bx,by)."""
    # Convert lat/lng degrees approx to km around reference latitude
    ref_lat = math.radians((ax + bx) / 2.0)
    kx = 111.0 * math.cos(ref_lat)
    ky = 111.0

    px_km, py_km = px * kx, py * ky
    ax_km, ay_km = ax * kx, ay * ky
    bx_km, by_km = bx * kx, by * ky

    dx = bx_km - ax_km
    dy = by_km - ay_km

    if dx == 0 and dy == 0:
        return haversine_distance_km(px, py, ax, ay)

    t = ((px_km - ax_km) * dx + (py_km - ay_km) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))

    proj_x_km = ax_km + t * dx
    proj_y_km = ay_km + t * dy

    return math.sqrt((px_km - proj_x_km) ** 2 + (py_km - proj_y_km) ** 2)

def evaluate_route_deviation(current_lat: float, current_lng: float, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """
    Evaluates real-time location deviation against planned journey segment.
    Returns deviation distance in km and risk classification (LOW, MEDIUM, HIGH).
    """
    dev_distance_km = distance_to_segment_km(current_lat, current_lng, origin_lat, origin_lng, dest_lat, dest_lng)

    if dev_distance_km >= 5.0:
        risk_level = "HIGH"
        flag = "CRITICAL_ROUTE_DEVIATION"
    elif dev_distance_km >= 0.5:
        risk_level = "MEDIUM"
        flag = "MODERATE_ROUTE_DEVIATION"
    else:
        risk_level = "LOW"
        flag = "ON_COURSE"

    return {
        "deviationDistanceKm": round(dev_distance_km, 3),
        "riskLevel": risk_level,
        "flag": flag,
        "isDeviated": dev_distance_km >= 0.5
    }
