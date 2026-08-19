export const scoreRoute = (db, waypoints, hour) => {
  if (!waypoints || waypoints.length === 0) {
    return { totalScore: 0, breakdown: { incidentDensity: 0, lightingCoverage: 0, timeOfDayFactor: 0, footTrafficInverse: 0 }, recommendation: 'safe' };
  }

  // Simplified logic for testing
  let totalIncidents = 0;
  let totalLightingScore = 0;
  let lightingPoints = 0;

  for (const wp of waypoints) {
    // Mock Haversine matching within ~500m
    const incidents = db.prepare(`
      SELECT * FROM route_incidents 
      WHERE abs(lat - ?) < 0.005 AND abs(lng - ?) < 0.005
    `).all(wp.lat, wp.lng);
    totalIncidents += incidents.length;

    const lights = db.prepare(`
      SELECT * FROM route_lighting 
      WHERE abs(lat - ?) < 0.005 AND abs(lng - ?) < 0.005
    `).all(wp.lat, wp.lng);
    
    for (const light of lights) {
      totalLightingScore += light.coverage_score;
      lightingPoints++;
    }
  }

  const incidentDensity = Math.min(totalIncidents / 10, 1.0);
  const lightingCoverage = lightingPoints > 0 ? (totalLightingScore / lightingPoints) : 0;
  
  let timeOfDayFactor = 0;
  if (hour >= 18 || hour < 6) {
    const off = hour >= 18 ? hour - 18 : hour + 6;
    timeOfDayFactor = off <= 8 ? (off / 8) : 1 - ((off - 8) / 4); // Peak at 2am (8 hours after 6pm)
  }

  const footTrafficInverse = (hour >= 22 || hour <= 5) ? 0.8 : 0.2;

  const totalScore = 0.35 * incidentDensity + 0.25 * (1 - lightingCoverage) + 0.25 * timeOfDayFactor + 0.15 * footTrafficInverse;
  
  let recommendation = 'safe';
  if (totalScore > 0.7) recommendation = 'high_risk';
  else if (totalScore > 0.4) recommendation = 'caution';

  return {
    totalScore,
    breakdown: { incidentDensity, lightingCoverage, timeOfDayFactor, footTrafficInverse },
    recommendation
  };
};