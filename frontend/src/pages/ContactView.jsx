import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import AlertBanner from '../components/AlertBanner';
import { useSocket } from '../hooks/useSocket';
import { apiGet } from '../services/api';

export default function ContactView() {
  const { id, shareToken } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const { socket } = useSocket();
  const alertBannerRef = useRef(null);

  const fetchTripStatus = () => {
    apiGet(`/api/trips/${id}/status/${shareToken}`)
      .then(setTrip)
      .catch(() => setError('This safety link has expired or is invalid.'));
  };

  useEffect(() => {
    fetchTripStatus();
  }, [id, shareToken]);

  useEffect(() => {
    if (socket && trip) {
      socket.emit('trip:join', id);

      socket.on('alert:new', (data) => {
        setAlert(data);
        fetchTripStatus();
        if (alertBannerRef.current) alertBannerRef.current.focus();
      });

      socket.on('alert:evidence', () => fetchTripStatus());

      socket.on('location:update', (loc) => {
        setTrip(t => t ? ({ ...t, latestCheckin: { ...(t.latestCheckin || {}), lat: loc.lat, lng: loc.lng } }) : t);
      });
    }
    return () => {
      if (socket) {
        socket.off('alert:new');
        socket.off('alert:evidence');
        socket.off('location:update');
      }
    };
  }, [socket, trip, id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="glass-card p-8 max-w-md w-full border border-red-500/50">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Link Expired or Invalid</h2>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!trip) return <div className="p-8 text-center text-slate-400">Loading live traveler safety feed...</div>;

  return (
    <div className="max-w-2xl mx-auto w-full p-4 md:p-6 min-h-screen pb-20">
      <div className="flex items-center justify-between mb-3">
        <button 
          onClick={() => navigate(-1)} 
          className="bg-slate-900/90 hover:bg-slate-800 text-cyan-300 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-700 shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>←</span> Back
        </button>
        <span className="text-xs text-slate-400 font-mono font-semibold">Shared Safety Feed</span>
      </div>

      <div ref={alertBannerRef} tabIndex={-1} className="outline-none">
        <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />
      </div>

      <div className="glass-card p-6 mb-6 text-center border-t-4 border-t-sr-info shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-1">{trip.user?.name || 'Traveler'}'s Live Safety View</h1>
        <p className="text-slate-300 text-sm mb-4">{trip.origin} → {trip.destination}</p>
        
        <div className="flex items-center justify-center gap-2">
          <span className={`px-3.5 py-1 rounded-full text-xs font-bold text-white ${trip.status === 'safe' || trip.status === 'active' ? 'bg-sr-safe' : 'bg-sr-danger animate-pulse shadow-lg'}`}>
            STATUS: {trip.status.toUpperCase()}
          </span>
        </div>
      </div>

      <h3 className="font-bold text-sm text-slate-300 mb-3 px-1 flex items-center gap-2">
        <span>📍</span> Traveler's Real GPS Position
      </h3>
      <div className="h-64 rounded-2xl overflow-hidden mb-6 border border-slate-700 shadow-lg">
        <MapView 
          center={trip.latestCheckin ? [trip.latestCheckin.lat, trip.latestCheckin.lng] : [28.6139, 77.2090]} 
          currentLocation={trip.latestCheckin} 
        />
      </div>

      {trip.alerts && trip.alerts.length > 0 && (
        <div className="glass-card p-6 mb-6 border border-red-500/40 shadow-xl">
          <h3 className="font-bold text-red-400 mb-4 flex items-center gap-2">
            <span>🚨</span> Emergency Alerts & Captured Evidence ({trip.alerts.length})
          </h3>
          
          <div className="space-y-4">
            {trip.alerts.map(a => (
              <div key={a.id} className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 text-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-red-400 uppercase text-xs tracking-wide">
                    🚨 {a.type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleTimeString()}</span>
                </div>

                {a.photo_url && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1">
                      📸 Captured Emergency Camera Snapshot:
                    </p>
                    <img 
                      src={a.photo_url} 
                      alt="Emergency Snapshot" 
                      className="w-full max-h-56 object-cover rounded-xl border border-slate-700 shadow-md"
                    />
                  </div>
                )}

                {a.evidence_url && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                      🎙️ Audio Evidence Clip:
                    </p>
                    <audio controls className="w-full h-9 rounded-lg" src={a.evidence_url}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-center text-slate-400 shadow">
        🔒 Encrypted End-to-End Shared View • Realtime Socket & Web Push Notifications Active
      </div>
    </div>
  );
}
