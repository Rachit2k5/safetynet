import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../App';
import { apiGet } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';
import EmergencyServices from '../components/EmergencyServices';
import VideoCaptureButton from '../components/VideoCaptureButton';

export default function Dashboard() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(null);
  const [recent, setRecent] = useState([]);
  const { position, isTracking } = useGeolocation();

  useEffect(() => {
    if (!user) navigate('/profile');
    else {
      apiGet('/api/trips').then(data => {
        const active = data.find(t => t.status === 'active' || t.status === 'panic');
        if (active) setActiveTrip(active);
        setRecent(data.filter(t => t.status !== 'active').slice(0, 5));
      }).catch(() => {});
    }
  }, [user, navigate]);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-24 hero-gradient relative min-h-screen">
      {/* Header Bar */}
      <header className="flex justify-between items-center mb-6 pt-2">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span aria-hidden="true">🛡️</span> SafeRoute
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">AI Personal Safety Companion</p>
        </div>

        <Link to="/profile" className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-500 transition-all">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center border border-cyan-400/40">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-xs font-semibold text-white pr-1">{user?.name || 'Profile'}</span>
        </Link>
      </header>

      {/* GPS Hardware Status Indicator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 mb-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isTracking ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
          <span className="text-xs font-bold text-slate-200">
            {position ? `GPS Active (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})` : 'Hardware GPS Connecting...'}
          </span>
        </div>
        <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/40">
          PROTECTED
        </span>
      </div>

      {/* Active Trip Banner or Quick Start */}
      <div className="mb-6">
        {activeTrip ? (
          <div className="glass-card p-6 border-2 border-emerald-500/80 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="bg-emerald-900/90 text-emerald-200 text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/50 flex items-center gap-1.5 w-max">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> ACTIVE SAFETY TRIP
                </span>
                <h2 className="text-xl font-black text-white mt-2">{activeTrip.origin} → {activeTrip.destination}</h2>
              </div>
            </div>

            <Link 
              to={`/trip/${activeTrip.id}`} 
              className="btn-safe w-full block text-center py-3.5 rounded-xl font-bold text-sm shadow-xl mt-4"
            >
              🚀 View Live Trip Monitor & Panic Controls
            </Link>
          </div>
        ) : (
          <div className="glass-card p-6 border border-slate-700/80 shadow-xl relative overflow-hidden text-center">
            <div className="text-4xl mb-3" aria-hidden="true">🗺️</div>
            <h2 className="text-xl font-bold text-white mb-2">Plan a Safe Route</h2>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed max-w-sm mx-auto">
              Analyze lighting, past incident density, and time-of-day risks from your GPS coordinates.
            </p>
            <Link to="/routes" className="btn-info w-full block text-center py-3.5 rounded-xl font-bold text-sm shadow-xl">
              📍 Analyze Route Safety Scores
            </Link>
          </div>
        )}
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link to="/routes" className="glass-card p-4 border border-slate-700/70 hover:border-sr-info transition-all flex flex-col justify-between group">
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform" aria-hidden="true">🧭</div>
          <div>
            <h3 className="font-bold text-white text-sm">Route Scoring</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Multi-factor risk engine</p>
          </div>
        </Link>

        <Link to="/profile" className="glass-card p-4 border border-slate-700/70 hover:border-emerald-500 transition-all flex flex-col justify-between group">
          <div className="text-2xl mb-2 group-hover:scale-110 transition-transform" aria-hidden="true">👥</div>
          <div>
            <h3 className="font-bold text-white text-sm">Trusted Contacts</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Instant email & audio alert network</p>
          </div>
        </Link>
      </div>

      {/* Incident Camera Video Capture Option */}
      <div className="mb-6">
        <VideoCaptureButton tripId={activeTrip?.id} />
      </div>

      {/* Nearest Police Stations & Official Emergency Helplines */}
      <EmergencyServices position={position} />

      {/* Recent Trips List */}
      <div className="mb-6">
        <h3 className="font-bold text-sm text-slate-300 mb-3 flex items-center gap-2">
          <span>🕒</span> Recent Safety Trips
        </h3>
        <div className="space-y-2.5">
          {recent.map(t => (
            <div key={t.id} className="glass-card p-3.5 text-xs flex justify-between items-center border border-slate-800 hover:border-slate-700 transition-all">
              <div>
                <p className="font-bold text-white text-sm">{t.origin} → {t.destination}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{new Date(t.created_at || Date.now()).toLocaleDateString()}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${t.status === 'completed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' : 'bg-slate-800 text-slate-400'}`}>
                {t.status}
              </span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-slate-500 text-xs italic text-center py-4">No recent trips yet.</p>}
        </div>
      </div>

      {/* Glassmorphic Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 px-4 py-2.5 flex justify-around items-center z-40">
        <Link to="/" className="flex flex-col items-center gap-0.5 text-sr-info font-bold">
          <span className="text-lg">📊</span>
          <span className="text-[10px]">Dashboard</span>
        </Link>
        <Link to="/routes" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white transition-colors">
          <span className="text-lg">🗺️</span>
          <span className="text-[10px]">Route AI</span>
        </Link>
        <Link to="/parent" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-cyan-400 transition-colors">
          <span className="text-lg">🔒</span>
          <span className="text-[10px] font-bold">Parent Portal</span>
        </Link>
        <Link to="/profile" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-white transition-colors">
          <span className="text-lg">👤</span>
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
