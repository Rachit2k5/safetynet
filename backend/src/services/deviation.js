export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const checkDeviation = (currentLat, currentLng, routeWaypoints) => {
  if (!routeWaypoints || routeWaypoints.length === 0) return { distanceMeters: 0, severity: 'none' };
  
  let minDistance = Infinity;
  for (const wp of routeWaypoints) {
    const dist = haversineDistance(currentLat, currentLng, wp.lat, wp.lng);
    if (dist < minDistance) minDistance = dist;
  }

  let severity = 'none';
  if (minDistance > 500) severity = 'hard';
  else if (minDistance >= 200) severity = 'soft';

  return { distanceMeters: minDistance, severity };
};