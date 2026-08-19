import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import { apiPost, apiGet, apiPut } from '../services/api';
import { useSocket } from '../hooks/useSocket';

const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path}`;
};

export default function ParentPortal() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [parentToken, setParentToken] = useState(() => localStorage.getItem('sr_parent_token') || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');

  const fetchParentDashboard = async (token, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await apiGet('/api/parent/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(res);
      setError(null);
    } catch (err) {
      console.error('Parent dashboard fetch error:', err);
      if (showLoading) {
        setError('Parent session expired or invalid. Please re-enter Parent Security PIN.');
        setParentToken('');
        localStorage.removeItem('sr_parent_token');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (!parentToken) return;

    fetchParentDashboard(parentToken, true);

    // Auto-poll every 3 seconds for real-time live GPS hardware sync
    const timer = setInterval(() => {
      fetchParentDashboard(parentToken, false);
    }, 3000);

    return () => clearInterval(timer);
  }, [parentToken]);

  useEffect(() => {
    if (socket && dashboardData?.activeTrip?.id) {
      const tripId = dashboardData.activeTrip.id;
      socket.emit('trip:join', tripId);

      socket.on('location:update', (loc) => {
        setDashboardData(prev => {
          if (!prev || !prev.activeTrip) return prev;
          return {
            ...prev,
            activeTrip: {
              ...prev.activeTrip,
              current_lat: loc.lat,
              current_lng: loc.lng
            }
          };
        });
      });

      socket.on('alert:new', () => {
        if (parentToken) fetchParentDashboard(parentToken, false);
      });

      socket.on('alert:evidence', () => {
        if (parentToken) fetchParentDashboard(parentToken, false);
      });
    }

    return () => {
      if (socket) {
        socket.off('location:update');
        socket.off('alert:new');
        socket.off('alert:evidence');
      }
    };
  }, [socket, dashboardData?.activeTrip?.id, parentToken]);

  const handleParentLogin = async (e) => {
    e.preventDefault();
    const enteredPin = (pin && pin.trim()) || '1234';

    setLoading(true);
    setError(null);

    let childUserId = null;
    let childEmail = null;
    const storedSession = localStorage.getItem('sr_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        childUserId = parsed.id;
        childEmail = parsed.email;
      } catch (err) {}
    }

    try {
      const res = await apiPost('/api/parent/login', {
        pin: enteredPin,
        user_id: childUserId,
        email: childEmail
      });
      if (res.parentToken) {
        setParentToken(res.parentToken);
        localStorage.setItem('sr_parent_token', res.parentToken);
        fetchParentDashboard(res.parentToken);
      }
    } catch (err) {
      setError(err?.detail || err?.message || 'Invalid Parent Security Password / PIN. Default PIN is 1234');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setParentToken('');
    setDashboardData(null);
    localStorage.removeItem('sr_parent_token');
  };

  const handleUpdateParentPin = async (e) => {
    e.preventDefault();
    if (!newPin || newPin.trim().length < 4) {
      setPinErr('Parent Security PIN must be at least 4 digits');
      return;
    }
    setPinErr('');
    setPinMsg('');
    try {
      await apiPut('/api/parent/pin', { pin: newPin.trim() }, {
        headers: { Authorization: `Bearer ${parentToken}` }
      });
      setPinMsg('✓ Parent Security PIN updated successfully!');
      setNewPin('');
      setTimeout(() => setPinMsg(''), 4000);
    } catch (err) {
      setPinErr(err?.detail || err?.message || 'Failed to update Parent PIN.');
    }
  };

  // Lock Screen View if not authenticated as parent
  if (!parentToken || !dashboardData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-screen hero-gradient text-center">
        <div className="w-full max-w-md mb-4 flex justify-start">
          <button
            onClick={() => navigate('/')}
            className="bg-slate-900/90 hover:bg-slate-800 text-cyan-300 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700/80 shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>←</span> Return to Traveler App
          </button>
        </div>
        <div className="glass-card p-8 border border-slate-700 max-w-md w-full shadow-2xl relative overflow-hidden">
          <div className="text-5xl mb-3" aria-hidden="true">🔒</div>
          <h1 className="text-2xl font-black text-white mb-1">Parent & Guardian Portal</h1>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Protected Parent-Only Access. Enter your Parent Security PIN to track your child's live hardware GPS location and view real-time camera & video evidence recordings.
          </p>

          {error && (
            <div className="bg-red-950/90 border border-red-500 text-red-200 p-3 rounded-xl text-xs mb-4 font-bold shadow">
              {error}
            </div>
          )}

          <form onSubmit={handleParentLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 text-left mb-1">
                Parent Security Password / PIN
              </label>
              <input
                type="password"
                placeholder="Enter Parent PIN (Default: 1234)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3.5 text-center text-lg font-mono text-white outline-none focus:ring-2 focus:ring-sr-info tracking-widest"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-info w-full py-3.5 rounded-xl font-bold text-sm shadow-xl hover:brightness-110 transition-all"
            >
              {loading ? 'Verifying Parent Credentials...' : '🔑 UNLOCK PARENT GUARDIAN PORTAL'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 mt-6 italic">
            Note: This portal is password-protected so children/travelers cannot alter or bypass guardian tracking.
          </p>
        </div>
      </div>
    );
  }

  const child = dashboardData.child || {};
  const activeTrip = dashboardData.activeTrip || {};
  const evidenceVault = dashboardData.evidenceVault || [];
  const checkinLogs = dashboardData.checkinLogs || [];

  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsSyncMsg, setGpsSyncMsg] = useState('');

  const handleFetchTravelerGps = async () => {
    setFetchingGps(true);
    setGpsSyncMsg('');
    try {
      if (socket && dashboardData?.activeTrip?.id) {
        socket.emit('location:request', { tripId: dashboardData.activeTrip.id });
      }
      await fetchParentDashboard(parentToken, false);
      const timeStr = new Date().toLocaleTimeString();
      setGpsSyncMsg(`Hardware GPS successfully fetched from traveler app at ${timeStr}! (${currentLat.toFixed(6)}, ${currentLng.toFixed(6)})`);
      setTimeout(() => setGpsSyncMsg(''), 5000);
    } catch (err) {
      console.error('Failed to fetch traveler GPS:', err);
    } finally {
      setFetchingGps(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-28 min-h-screen hero-gradient max-w-4xl mx-auto w-full">
      {/* Top Header Bar */}
      <header className="flex justify-between items-center mb-6 glass-card p-4 border border-slate-700/80 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h1 className="text-xl font-black text-white">Parent Guardian Portal</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Tracking Child: <strong className="text-cyan-300 font-bold">{child.name || 'Traveler'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-1 shadow-md"
          >
            <span>←</span> Traveler App
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-950/70 hover:bg-red-900/80 text-red-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-800/60 transition-all flex items-center gap-1 shadow-md"
          >
            <span>🔒</span> Lock
          </button>
        </div>
      </header>

      {/* Live GPS Map View */}
      <div className="glass-card p-4 mb-6 border border-slate-700/80 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📍</span> Real-Time Hardware GPS Location
            </h2>
            <p className="text-[11px] text-slate-400">
              Live GPS Position: <strong className="text-cyan-300 font-mono">({currentLat.toFixed(6)}, {currentLng.toFixed(6)})</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleFetchTravelerGps}
              disabled={fetchingGps}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg border border-emerald-400 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span>📡</span> {fetchingGps ? 'Fetching Traveler GPS...' : 'Fetch Live Traveler GPS'}
            </button>

            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
              activeTrip.status === 'panic' ? 'bg-red-600 text-white animate-pulse' :
              activeTrip.status === 'attention_required' ? 'bg-amber-600 text-white' :
              'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
            }`}>
              {activeTrip.status || 'Active Safety Monitoring'}
            </span>
          </div>
        </div>

        {gpsSyncMsg && (
          <div className="mb-3 bg-emerald-950/90 border border-emerald-500 text-emerald-200 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow">
            <span>✓</span> {gpsSyncMsg}
          </div>
        )}

        <div className="h-72 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
          <MapView
            center={[currentLat, currentLng]}
            currentLocation={{ lat: currentLat, lng: currentLng }}
            zoom={15}
          />
        </div>

        <div className="mt-3 flex justify-between items-center text-xs text-slate-400 font-mono">
          <span>GPS Coordinates: ({currentLat.toFixed(6)}, {currentLng.toFixed(6)})</span>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${currentLat},${currentLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sr-info hover:underline font-bold"
          >
            🗺️ Open Direct Google Maps Directions
          </a>
        </div>
      </div>

      {/* Live Camera, Audio & Video Evidence Vault */}
      <div className="glass-card p-5 mb-6 border border-slate-700/80 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <span>📸</span> Real-Time Incident Evidence & Camera Recordings
        </h2>

        {evidenceVault.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-4">
            No emergency incident evidence recordings yet. Automatically updates when panic or voice distress is triggered.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceVault.map((item, idx) => (
              <div key={idx} className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-3 shadow-lg">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-red-400 uppercase">🚨 Incident #{item.alertId.slice(0, 8)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>

                {/* Photo Evidence */}
                {item.photoUrl && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-300 mb-1">📸 Camera Snapshot Photo:</p>
                    <img
                      src={getMediaUrl(item.photoUrl)}
                      alt="Incident Snapshot"
                      className="w-full h-40 object-cover rounded-lg border border-red-500/50 shadow"
                    />
                  </div>
                )}

                {/* Audio Evidence */}
                {item.audioUrl && (
                  <div>
                    <p className="text-[11px] font-bold text-cyan-300 mb-1">🎙️ Audio Evidence Recording:</p>
                    <audio
                      controls
                      src={getMediaUrl(item.audioUrl)}
                      className="w-full h-9 rounded-lg"
                    />
                  </div>
                )}

                {/* Video Evidence */}
                {item.videoUrl && (
                  <div>
                    <p className="text-[11px] font-bold text-rose-400 mb-1">🎥 Live Incident Video Recording:</p>
                    <video
                      controls
                      src={getMediaUrl(item.videoUrl)}
                      className="w-full h-44 object-cover rounded-lg border border-rose-500/50 bg-black"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spoken Word Activity Logs */}
      <div className="glass-card p-5 border border-slate-700/80 shadow-xl">
        <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span>🗣️</span> Timestamped Check-in & Voice Activity Logs
        </h2>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {checkinLogs.map((log) => (
            <div key={log.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs flex justify-between items-center">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">
                  [{new Date(log.created_at || Date.now()).toLocaleTimeString()}]
                </span>
                <p className="font-medium text-slate-200">{log.message}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                log.status === 'safe' ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
              }`}>
                {log.status || 'Check-in'}
              </span>
            </div>
          ))}
          {checkinLogs.length === 0 && (
            <p className="text-xs text-slate-500 italic text-center py-4">No check-in logs recorded yet.</p>
          )}
        </div>
      </div>

      {/* Change Parent Security PIN Settings Card (Parent-Only Access) */}
      <div className="glass-card p-5 border border-slate-700/80 shadow-xl space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🔒</span> Change Parent Security PIN
        </h2>
        <p className="text-xs text-slate-400">
          Update your secret Parent Security PIN. Only parents logged into this portal can change this PIN.
        </p>

        {pinMsg && <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 font-bold">{pinMsg}</div>}
        {pinErr && <div className="p-2.5 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-300 font-bold">{pinErr}</div>}

        <form onSubmit={handleUpdateParentPin} className="flex gap-2">
          <input
            type="password"
            placeholder="Enter New Parent PIN (min 4 digits)"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:ring-2 focus:ring-sr-info font-mono tracking-widest text-center"
            required
          />
          <button type="submit" className="btn-info px-5 py-3 rounded-xl font-bold text-xs shadow-md whitespace-nowrap">
            Update PIN
          </button>
        </form>
      </div>
    </div>
  );
}
