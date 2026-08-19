import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import { apiPost } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

export default function RouteSelector() {
  const { position, isTracking, error: geoError } = useGeolocation();
  const [origin, setOrigin] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destination, setDestination] = useState('West Hostel');
  const [destCoords, setDestCoords] = useState({ lat: 28.6180, lng: 77.2150 });
  const [hour, setHour] = useState(new Date().getHours());
  const [checkinMinutes, setCheckinMinutes] = useState(5);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-detect instant GPS location on mount
  useEffect(() => {
    if (position && !originCoords) {
      const label = `Current Location (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`;
      setOrigin(label);
      setOriginCoords(position);
    }
  }, [position, originCoords]);

  const handleUseCurrentLocation = () => {
    if (position) {
      const label = `Current Location (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`;
      setOrigin(label);
      setOriginCoords(position);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setOrigin(`Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
          setOriginCoords(coords);
        },
        () => alert('Could not fetch hardware GPS position. Please check location permissions.')
      );
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);

    const startLat = originCoords?.lat || 28.6139;
    const startLng = originCoords?.lng || 77.2090;
    const endLat = destCoords?.lat || (startLat + 0.004);
    const endLng = destCoords?.lng || (startLng + 0.006);

    try {
      const res = await apiPost('/api/routes/score', {
        hour: parseInt(hour, 10),
        routes: [
          {
            name: `${origin || 'Current Location'} -> ${destination} (Main Lit Highway)`,
            waypoints: [
              { lat: startLat, lng: startLng },
              { lat: startLat + (endLat - startLat) * 0.5, lng: startLng + (endLng - startLng) * 0.3 },
              { lat: endLat, lng: endLng }
            ]
          },
          {
            name: `${origin || 'Current Location'} -> ${destination} (Alley Shortcut)`,
            waypoints: [
              { lat: startLat, lng: startLng },
              { lat: startLat + (endLat - startLat) * 0.2, lng: startLng + (endLng - startLng) * 0.7 },
              { lat: endLat, lng: endLng }
            ]
          }
        ]
      });
      setScores(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async (routeName, waypoints) => {
    try {
      const startLat = waypoints[0]?.lat || 28.6139;
      const startLng = waypoints[0]?.lng || 77.2090;
      const endLat = waypoints[waypoints.length - 1]?.lat || 28.6180;
      const endLng = waypoints[waypoints.length - 1]?.lng || 77.2150;

      const intervalMs = (parseInt(checkinMinutes, 10) || 5) * 60 * 1000;

      const res = await apiPost('/api/trips', {
        origin: origin || 'Current Location',
        destination: `${destination} (${routeName})`,
        origin_lat: startLat,
        origin_lng: startLng,
        dest_lat: endLat,
        dest_lng: endLng,
        checkin_interval_ms: intervalMs
      });
      navigate(`/trip/${res.id}`);
    } catch (err) {
      alert('Failed to start trip. Make sure you are logged in.');
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto w-full min-h-screen pb-20">
      <h2 className="text-2xl font-bold mb-2">AI Route Safety Scoring</h2>
      <p className="text-sm text-slate-400 mb-6">Analyzes lighting, past incident density, foot traffic, and time-of-day risk from your GPS location.</p>

      <form onSubmit={handleAnalyze} className="glass-card p-6 mb-6 flex flex-col gap-4 border border-slate-700">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-300">Origin Location</label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="text-xs text-sr-info hover:underline font-bold flex items-center gap-1"
            >
              <span>📍</span> {position ? 'Re-sync GPS Location' : 'Locate Me'}
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={isTracking && !origin ? "📍 Fetching hardware GPS position..." : "Origin Address or Coords"}
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:ring-2 focus:ring-sr-info pr-10"
              required
            />
            {position && (
              <span className="absolute right-3 top-3.5 text-xs text-emerald-400 font-bold" title="Hardware GPS Active">
                ✓ GPS
              </span>
            )}
          </div>
          {geoError && <p className="text-[11px] text-amber-400 mt-1">Location alert: {geoError}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Destination</label>
          <input
            type="text"
            placeholder="Destination Address"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:ring-2 focus:ring-sr-info"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">⏱️ User-Defined Check-in Timer Interval</label>
          <div className="flex gap-2 mb-2">
            {[3, 5, 10, 15, 30].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => setCheckinMinutes(mins)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                  checkinMinutes === mins 
                    ? 'bg-sr-info text-slate-950 border-cyan-400 font-black shadow-md' 
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">Custom Interval:</span>
            <input
              type="number"
              min="1"
              max="1440"
              value={checkinMinutes}
              onChange={e => setCheckinMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs text-center outline-none focus:ring-2 focus:ring-sr-info font-mono font-bold"
            />
            <span className="text-xs text-slate-400">minutes</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Departure Time</label>
          <select
            value={hour}
            onChange={e => setHour(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none"
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <option key={i} value={i}>
                {i === 0 ? '12:00 AM (Midnight)' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM (Noon)' : `${i - 12}:00 PM`}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} className="btn-info py-3.5 rounded-xl font-bold text-sm mt-2 shadow-lg">
          {loading ? 'Analyzing GPS & Incident Clusters...' : 'Analyze Safety Scores'}
        </button>
      </form>

      {/* Direct Click-to-Call Emergency Helpline Card */}
      <div className="glass-card p-5 border border-red-500/40 shadow-xl space-y-3 mb-6">
        <h3 className="text-sm font-bold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>📞</span> Emergency Helplines & Police Departments
          </span>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded uppercase">Direct Click-to-Call</span>
        </h3>
        <p className="text-xs text-slate-400">
          Tap any department button below to directly dial emergency services or police from your phone.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <a
            href="tel:112"
            className="p-3 bg-red-950/80 hover:bg-red-900 border border-red-500/80 rounded-xl text-center shadow-lg transition-all"
          >
            <span className="text-xs font-bold text-red-200 block">🚨 National Emergency</span>
            <span className="text-base font-black text-white font-mono">112</span>
            <span className="text-[10px] text-red-300 font-bold block mt-1">📞 Click to Call</span>
          </a>

          <a
            href="tel:100"
            className="p-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-center shadow-lg transition-all"
          >
            <span className="text-xs font-bold text-cyan-300 block">🚓 Police Control Room</span>
            <span className="text-base font-black text-white font-mono">100</span>
            <span className="text-[10px] text-cyan-400 font-bold block mt-1">📞 Click to Call</span>
          </a>

          <a
            href="tel:1091"
            className="p-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 rounded-xl text-center shadow-lg transition-all"
          >
            <span className="text-xs font-bold text-purple-300 block">👩 Women Safety Helpline</span>
            <span className="text-base font-black text-white font-mono">1091</span>
            <span className="text-[10px] text-purple-400 font-bold block mt-1">📞 Click to Call</span>
          </a>
        </div>
      </div>

      <div className="space-y-6">
        {scores.map((item, index) => {
          const score = item.scoreData;
          const riskPercentage = Math.round(score.totalScore * 100);
          return (
            <div key={index} className="glass-card overflow-hidden border border-slate-700">
              <div className="p-4 flex justify-between items-center bg-slate-800/60">
                <div>
                  <h3 className="font-bold text-white text-sm">{item.name}</h3>
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mt-1 ${score.recommendation === 'safe' ? 'bg-emerald-900/80 text-emerald-300' : score.recommendation === 'caution' ? 'bg-amber-900/80 text-amber-300' : 'bg-red-900/80 text-red-300'}`}>
                    {score.recommendation.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${riskPercentage > 60 ? 'text-sr-danger' : riskPercentage > 35 ? 'text-sr-warning' : 'text-sr-safe'}`}>
                    {riskPercentage}%
                  </div>
                  <div className="text-[10px] text-slate-400">Risk Score</div>
                </div>
              </div>

              <div className="h-48 border-y border-slate-700">
                <MapView 
                  center={[item.scoreData.waypoints?.[0]?.lat || 28.6139, item.scoreData.waypoints?.[0]?.lng || 77.2090]} 
                  zoom={14} 
                  origin={item.scoreData.waypoints?.[0]}
                  destination={item.scoreData.waypoints?.[item.scoreData.waypoints.length - 1]}
                  routeWaypoints={item.scoreData.waypoints} 
                />
              </div>

              <div className="p-4 bg-slate-900/50 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Incident Density:</span>
                  <span className="font-mono">{Math.round(score.breakdown.incidentDensity * 100)}%</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Lighting Coverage Penalty:</span>
                  <span className="font-mono">{Math.round((1 - score.breakdown.lightingCoverage) * 100)}%</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Time-of-Day Risk:</span>
                  <span className="font-mono">{Math.round(score.breakdown.timeOfDayFactor * 100)}%</span>
                </div>
              </div>

              <div className="p-4">
                <button 
                  onClick={() => handleStartTrip(item.name, item.scoreData.waypoints || [])} 
                  className="w-full btn-safe py-3 rounded-lg font-bold text-sm"
                >
                  Select & Start Safety Trip ({checkinMinutes}m Check-in)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
