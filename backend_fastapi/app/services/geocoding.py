import urllib.request
import urllib.parse
import json
from app.services.haversine import haversine_distance_km

def fetch_server_police_stations(lat: float, lng: float, radius_km: float = 5.0) -> list:
    """
    Queries Nominatim / OpenStreetMap Overpass API server-side for real police stations.
    Calculates exact Haversine distance and returns structured list.
    """
    radius_meters = int(radius_km * 1000)
    overpass_query = f"""
    [out:json][timeout:10];
    (
      node["amenity"="police"](around:{radius_meters},{lat},{lng});
      way["amenity"="police"](around:{radius_meters},{lat},{lng});
    );
    out center 10;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    headers = {"User-Agent": "SafeRouteBackend/1.0 (Emergency Safety App)"}

    try:
        req = urllib.request.Request(url, data=overpass_query.encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        elements = data.get("elements", [])
        results = []
        for elem in elements:
            p_lat = elem.get("lat") or (elem.get("center") and elem["center"].get("lat"))
            p_lng = elem.get("lon") or (elem.get("center") and elem["center"].get("lon"))
            if not p_lat or not p_lng:
                continue

            dist_km = haversine_distance_km(lat, lng, p_lat, p_lng)
            tags = elem.get("tags", {})
            name = tags.get("name") or tags.get("name:en") or "Police Station / Control Outpost"
            street = tags.get("addr:street") or tags.get("addr:suburb") or tags.get("addr:full") or "Local Police Jurisdiction"

            results.append({
                "id": elem.get("id"),
                "name": name,
                "address": street,
                "lat": p_lat,
                "lng": p_lng,
                "distanceKm": round(dist_km, 2),
                "directionsUrl": f"https://www.google.com/maps/dir/?api=1&destination={p_lat},{p_lng}"
            })

        results.sort(key=lambda x: x["distanceKm"])
        return results[:5]
    except Exception as err:
        print(f"[WARN] Server-side Overpass geocoding error: {err}")
        return []
