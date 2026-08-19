import React, { useState, useEffect } from 'react';

// Haversine distance formula in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EmergencyServices({ position }) {
  const [policeStations, setPoliceStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchNearestPoliceStations = async (lat, lng) => {
    setLoading(true);
    setError(null);
    try {
      // Query OpenStreetMap Overpass API for police amenities within 5km
      const query = `[out:json][timeout:8];(node["amenity"="police"](around:5000,${lat},${lng});way["amenity"="police"](around:5000,${lat},${lng}););out center 8;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to query Overpass API');
      const data = await res.json();

      const results = (data.elements || [])
        .map(elem => {
          const pLat = elem.lat || (elem.center && elem.center.lat);
          const pLng = elem.lon || (elem.center && elem.center.lon);
          if (!pLat || !pLng) return null;
          const distKm = getDistanceKm(lat, lng, pLat, pLng);
          const name = elem.tags?.name || elem.tags?.['name:en'] || 'Police Station / Outpost';
          const address = elem.tags?.['addr:street'] || elem.tags?.['addr:suburb'] || elem.tags?.['addr:full'] || 'Local Police Authority';
          return {
            id: elem.id,
            name,
            address,
            lat: pLat,
            lng: pLng,
            distKm: distKm
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, 4);

      setPoliceStations(results);
    } catch (err) {
      console.warn('Overpass API fetch error, fallback to direct search:', err);
      setError('Could not auto-fetch list. Use direct Google Maps lookup below.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (position?.lat && position?.lng) {
      fetchNearestPoliceStations(position.lat, position.lng);
    }
  }, [position?.lat, position?.lng]);

  const officialHelplines = [
    { name: 'National Emergency System (ERSS)', number: '112', icon: '🚨', desc: 'Police, Fire & Medical Integrated' },
    { name: 'Police Control Room', number: '100', icon: '👮', desc: 'Direct Police Emergency Assistance' },
    { name: 'Women Safety & Distress', number: '1091', icon: '👩', desc: '24/7 Women Emergency Line' },
    { name: 'Women Helpline (Abuse / Violence)', number: '181', icon: '🛡️', desc: 'Domestic Violence & Abuse Helpline' },
    { name: 'Cyber Crime Fraud Helpline', number: '1930', icon: '💻', desc: 'Financial Fraud & Online Harassment' },
    { name: 'Ambulance & Medical Emergency', number: '108', icon: '🚑', desc: 'Emergency Medical Services' },
    { name: 'Fire Department', number: '101', icon: '🚒', desc: 'Fire & Rescue Services' },
    { name: 'Childline Protection', number: '1098', icon: '👶', desc: 'Child Distress & Protection' }
  ];

  const mapSearchUrl = position
    ? `https://www.google.com/maps/search/police+station/@${position.lat},${position.lng},14z`
    : `https://www.google.com/maps/search/police+station/`;

  return (
    <div className="space-y-4 my-4">
      {/* Nearest Police Stations Card */}
      <div className="glass-card p-5 border border-slate-700/80 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚔</span>
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Nearest Police Stations ({position ? 'GPS Active' : 'Locating...'})
            </h3>
          </div>
          {position && (
            <a
              href={mapSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 px-2.5 py-1 rounded-lg border border-cyan-800/40 font-semibold transition"
            >
              📍 Search Google Maps
            </a>
          )}
        </div>

        {loading && (
          <div className="py-4 text-center text-xs text-slate-400 font-mono animate-pulse">
            🔍 Scanning OpenStreetMap database for nearby police stations...
          </div>
        )}

        {!loading && policeStations.length > 0 && (
          <div className="space-y-2.5">
            {policeStations.map(ps => (
              <div key={ps.id} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span>🚔</span> {ps.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{ps.address}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                    {ps.distKm < 1 ? `${Math.round(ps.distKm * 1000)} m away` : `${ps.distKm.toFixed(1)} km away`}
                  </span>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${ps.lat},${ps.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2 py-0.5 rounded font-semibold border border-slate-700"
                  >
                    🗺️ Directions
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && policeStations.length === 0 && position && (
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
            <p className="mb-2">Click below to view all verified police stations near your exact GPS location:</p>
            <a
              href={mapSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-info inline-block px-4 py-2 rounded-xl text-xs font-bold shadow"
            >
              📍 Open Verified Police Stations Map
            </a>
          </div>
        )}

        {!position && (
          <p className="text-xs text-slate-500 italic text-center py-2">
            Acquiring device GPS coordinates to list nearby police stations...
          </p>
        )}
      </div>

      {/* Official Verified Emergency Helplines Card */}
      <div className="glass-card p-5 border border-slate-700/80 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
            <span>☎️</span> Official Verified Emergency Helplines
          </h3>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
            Tap to Call
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {officialHelplines.map((item, idx) => (
            <a
              key={idx}
              href={`tel:${item.number}`}
              className="bg-slate-900/90 hover:bg-slate-800/90 p-3 rounded-xl border border-slate-800 hover:border-red-500/50 transition-all group flex justify-between items-center"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{item.icon}</span>
                  <span className="font-bold text-white text-xs group-hover:text-red-400 transition-colors">{item.name}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
              </div>
              <span className="text-sm font-black font-mono text-red-400 bg-red-950/80 border border-red-800/40 px-2.5 py-1 rounded-lg ml-2 whitespace-nowrap shadow">
                📞 {item.number}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
