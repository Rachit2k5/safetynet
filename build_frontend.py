import os
import subprocess

BASE_DIR = r"C:\Users\Asus\.gemini\antigravity\scratch\saferoute\frontend"

FILES = {
    "package.json": r"""{
  "name": "saferoute-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "leaflet": "^1.9.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1",
    "react-router-dom": "^6.28.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0"
  }
}""",

    "index.html": r"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0e1a" />
    <title>SafeRoute — Safety Companion</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="apple-touch-icon" href="/pwa-192x192.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>""",

    "vite.config.js": r"""import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'SafeRoute',
        short_name: 'SafeRoute',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        importScripts: ['/custom-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': 'http://localhost:3001'
    }
  }
});""",

    "tailwind.config.js": r"""/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        'sr-dark': { DEFAULT: '#0a0e1a', card: 'rgba(15, 23, 42, 0.8)', surface: '#111827' },
        'sr-safe': '#10b981',
        'sr-warning': '#f59e0b',
        'sr-danger': '#ef4444',
        'sr-info': '#06b6d4',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] }
    },
  },
  plugins: [],
}""",

    "postcss.config.js": r"""export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}""",

    "src/index.css": r"""@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-[#0a0e1a] text-slate-100 font-sans;
}

.glass-card {
  @apply bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow;
}

.btn-safe { @apply bg-sr-safe text-white hover:bg-emerald-600 transition-colors focus-visible:ring-2 focus-visible:ring-sr-safe focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e1a]; }
.btn-danger { @apply bg-sr-danger text-white hover:bg-red-600 transition-colors focus-visible:ring-2 focus-visible:ring-sr-danger focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e1a]; }
.btn-info { @apply bg-sr-info text-white hover:bg-cyan-600 transition-colors focus-visible:ring-2 focus-visible:ring-sr-info focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e1a]; }

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.hero-gradient {
  background: linear-gradient(-45deg, #0a0e1a, #111827, #1e293b, #0f172a);
  background-size: 400% 400%;
}

@keyframes pulse-dot {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

.live-dot {
  width: 12px; height: 12px; border-radius: 50%; background-color: #3b82f6;
}

@media (prefers-reduced-motion: no-preference) {
  .hero-gradient { animation: gradient-shift 15s ease infinite; }
  .live-dot { animation: pulse-dot 2s infinite; }
  .countdown-ring { transition: stroke-dashoffset 1s linear; }
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0a0e1a; }
::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }

.leaflet-layer,
.leaflet-control-zoom-in,
.leaflet-control-zoom-out,
.leaflet-control-attribution {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}""",

    "src/main.jsx": r"""import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'leaflet/dist/leaflet.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)""",

    "src/App.jsx": r"""import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createContext, useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import TripView from './pages/TripView';
import ContactView from './pages/ContactView';
import RouteSelector from './pages/RouteSelector';
import PWAPrompt from './components/PWAPrompt';
import OfflineBanner from './components/OfflineBanner';

export const UserContext = createContext(null);

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const stored = localStorage.getItem('sr_session');
    if (stored) { try { setUser(JSON.parse(stored)); } catch (e) {} }
  }, []);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col relative overflow-x-hidden">
          <OfflineBanner />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/trip/:id" element={<TripView />} />
            <Route path="/trip/:id/status/:shareToken" element={<ContactView />} />
            <Route path="/routes" element={<RouteSelector />} />
          </Routes>
          <PWAPrompt />
        </div>
      </BrowserRouter>
    </UserContext.Provider>
  );
}""",

    "src/services/api.js": r"""export const getApiUrl = () => import.meta.env.VITE_API_URL || '';

export const getHeaders = () => {
  const stored = localStorage.getItem('sr_session');
  let token = '';
  if (stored) { try { token = JSON.parse(stored).token; } catch (e) {} }
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const apiGet = async (path) => {
  const res = await fetch(`${getApiUrl()}${path}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiPost = async (path, body) => {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiPut = async (path, body) => {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiDelete = async (path) => {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};""",

    "src/services/pushSubscription.js": r"""export const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPush = async (userId) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.ready;
  const res = await fetch('/api/push/vapid-key');
  const { vapidKey } = await res.json();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey)
  });
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subscription })
  });
};

export const unsubscribeFromPush = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
};""",

    "src/services/offlineQueue.js": r"""const DB_NAME = 'saferoute-offline';
const STORE = 'pending-actions';

const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const queueAction = async (action) => {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...action, id: action.id || Date.now().toString(), timestamp: Date.now() });
    tx.oncomplete = () => resolve();
  });
};

export const getQueuedActions = async () => {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
  });
};

export const removeAction = async (id) => {
  const db = await dbPromise;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
};

export const flushQueue = async () => {
  const actions = await getQueuedActions();
  if (!actions.length) return;
  let delay = 1000;
  for (const action of actions) {
    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
      try {
        const stored = localStorage.getItem('sr_session');
        let token = stored ? JSON.parse(stored).token : '';
        const res = await fetch(action.url, {
          method: action.type || 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? {'Authorization': `Bearer ${token}`} : {}) },
          body: JSON.stringify(action.body)
        });
        if (res.ok) { await removeAction(action.id); success = true; }
        else throw new Error('Failed');
      } catch (e) {
        attempts++;
        if (attempts >= 5) break;
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30000);
      }
    }
  }
};""",

    "src/hooks/useOnlineStatus.js": r"""import { useState, useEffect } from 'react';
import { flushQueue } from '../services/offlineQueue';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) flushQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
};""",

    "src/hooks/useSocket.js": r"""import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL || '', { path: '/socket.io' });
    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));
    setSocket(s);
    return () => s.disconnect();
  }, []);

  return { socket, isConnected };
};""",

    "src/hooks/useGeolocation.js": r"""import { useState, useEffect } from 'react';

export const useGeolocation = (options = { highAccuracy: true, maxAge: 10000, timeout: 5000 }) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }
    setIsTracking(true);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: options.highAccuracy, maximumAge: options.maxAge, timeout: options.timeout }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsTracking(false);
    };
  }, [options.highAccuracy, options.maxAge, options.timeout]);

  return { position, error, isTracking };
};""",

    "src/components/PanicButton.jsx": r"""import React, { useState, useRef } from 'react';
import { queueAction } from '../services/offlineQueue';
import { apiPost } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

export default function PanicButton({ tripId }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState(null);
  const { position } = useGeolocation();
  const holdTimeout = useRef(null);

  const triggerPanic = async () => {
    setShowConfirm(false);
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    const payload = { location: position, timestamp: new Date().toISOString() };
    try {
      await apiPost(`/api/trips/${tripId}/panic`, payload);
      setStatus('success');
    } catch (e) {
      await queueAction({ type: 'POST', url: `/api/trips/${tripId}/panic`, body: payload });
      setStatus('queued');
    }
    setTimeout(() => setStatus(null), 5000);
  };

  const handleStart = () => {
    holdTimeout.current = setTimeout(() => setShowConfirm(true), 1000);
  };
  const handleEnd = () => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') setShowConfirm(true);
  };

  return (
    <div className="flex flex-col items-center gap-4 my-6">
      {status === 'success' && <div className="bg-sr-safe text-white px-4 py-2 rounded-lg font-medium" role="alert">Alert delivered to your contacts</div>}
      {status === 'queued' && <div className="bg-amber-600 text-white px-4 py-2 rounded-lg font-medium" role="alert">Alert queued — will send when back online</div>}
      <button
        className="w-32 h-32 rounded-full bg-sr-danger text-white font-bold text-xl shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:bg-red-700 transition-colors focus-visible:ring-4 focus-visible:ring-red-500 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0e1a]"
        onMouseDown={handleStart} onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={handleStart} onTouchEnd={handleEnd}
        onClick={() => setShowConfirm(true)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label="Emergency panic button — tap to alert all trusted contacts"
        aria-describedby="panic-desc"
      >
        EMERGENCY
      </button>
      <p id="panic-desc" className="text-slate-400 text-sm">Hold 1s or tap to activate</p>
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-white mb-2">Confirm Emergency?</h2>
            <p className="text-slate-300 mb-6">This will immediately notify all your trusted contacts with your live location.</p>
            <div className="flex gap-4">
              <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="flex-1 btn-danger py-3 rounded-lg font-bold" onClick={triggerPanic} autoFocus>SEND ALERT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}""",

    "src/components/MapView.jsx": r"""import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const liveIcon = L.divIcon({ className: 'live-dot', iconSize: [12, 12] });
const redPin = L.divIcon({ className: 'bg-sr-danger w-3 h-3 rounded-full', iconSize: [12, 12] });
const greenPin = L.divIcon({ className: 'bg-sr-safe w-3 h-3 rounded-full', iconSize: [12, 12] });

function MapBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, markers]);
  return null;
}

export default function MapView({ center, zoom = 13, currentLocation, origin, destination, routeWaypoints = [] }) {
  const markers = [currentLocation, origin, destination].filter(Boolean);
  return (
    <div className="w-full h-64 md:h-96 rounded-xl overflow-hidden glass-card z-0 relative">
      <MapContainer center={center || [0,0]} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {origin && <Marker position={[origin.lat, origin.lng]} icon={greenPin} />}
        {destination && <Marker position={[destination.lat, destination.lng]} icon={redPin} />}
        {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]} icon={liveIcon} />}
        {routeWaypoints.length > 0 && <Polyline positions={routeWaypoints.map(w => [w.lat, w.lng])} color="#06b6d4" weight={4} />}
        <MapBounds markers={markers} />
      </MapContainer>
    </div>
  );
}""",

    "src/components/CheckinTimer.jsx": r"""import React, { useState, useEffect } from 'react';
import { formatTime } from '../utils/formatters';
import { apiPost } from '../services/api';

export default function CheckinTimer({ deadline, onCheckin, tripId }) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(deadline).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const handleSafe = async () => {
    await apiPost(`/api/trips/${tripId}/checkin`, { message: msg });
    if (onCheckin) onCheckin();
    setMsg('');
  };

  const total = 15 * 60 * 1000;
  const pct = Math.max(0, (timeLeft / total) * 100);
  const isGrace = timeLeft === 0;
  
  return (
    <div className={`glass-card p-6 flex flex-col items-center ${isGrace ? 'bg-amber-900/50 border-amber-500' : ''}`}>
      <h3 className="text-lg font-bold mb-4">{isGrace ? 'Grace Period - Please Check In!' : 'Next Check-in'}</h3>
      <div className="relative w-32 h-32 flex items-center justify-center mb-6">
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="60" className="stroke-slate-700" strokeWidth="8" fill="none" />
          <circle cx="64" cy="64" r="60" className={`countdown-ring stroke-current ${pct > 50 ? 'text-sr-safe' : pct > 25 ? 'text-sr-warning' : 'text-sr-danger'}`} strokeWidth="8" fill="none" strokeDasharray="377" strokeDashoffset={377 - (377 * pct) / 100} />
        </svg>
        <span className="text-2xl font-bold">{formatTime(timeLeft)}</span>
      </div>
      <input type="text" placeholder="Optional message..." value={msg} onChange={e => setMsg(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 mb-4 text-sm focus:ring-2 focus:ring-sr-safe outline-none" />
      <button onClick={handleSafe} className="btn-safe w-full py-3 rounded-lg font-bold">I'm Safe</button>
    </div>
  );
}""",

    "src/components/AlertBanner.jsx": r"""import React, { useEffect, useRef } from 'react';
import { formatTime } from '../utils/formatters';

export default function AlertBanner({ alert, onDismiss }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) ref.current.focus();
  }, [alert]);

  if (!alert) return null;

  const bg = alert.severity === 'critical' ? 'bg-sr-danger' : 'bg-sr-warning text-slate-900';
  const textColor = alert.severity === 'critical' ? 'text-white' : 'text-slate-900';

  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-live="assertive" className={`${bg} ${textColor} p-4 rounded-xl flex items-start justify-between shadow-lg mb-4 outline-none focus-visible:ring-2 focus-visible:ring-white`}>
      <div className="flex gap-3">
        <span className="text-2xl" aria-hidden="true">{alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
        <div>
          <h4 className="font-bold">{alert.title || 'Safety Alert'}</h4>
          <p className="text-sm opacity-90">{alert.message}</p>
          <span className="text-xs opacity-75 block mt-1">{formatTime(new Date(alert.timestamp).getTime() - Date.now())} ago</span>
          {alert.lat && alert.lng && (
            <a href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`} target="_blank" rel="noreferrer" className="text-sm underline mt-2 inline-block">View Location</a>
          )}
        </div>
      </div>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss alert" className="opacity-75 hover:opacity-100 p-1">✕</button>}
    </div>
  );
}""",

    "src/components/PWAPrompt.jsx": r"""import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAPrompt() {
  const { offlineReady: [offlineReady, setOfflineReady], needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 glass-card p-4 z-50 flex flex-col gap-2 max-w-sm">
      <div className="text-sm">
        {offlineReady ? <span>App is ready to work offline.</span> : <span>New content available, click to update.</span>}
      </div>
      <div className="flex gap-2">
        {needRefresh && <button className="btn-info px-3 py-1 rounded text-sm" onClick={() => updateServiceWorker(true)}>Reload</button>}
        <button className="bg-slate-700 px-3 py-1 rounded text-sm" onClick={() => { setOfflineReady(false); setNeedRefresh(false); }}>Close</button>
      </div>
    </div>
  );
}""",

    "src/components/OfflineBanner.jsx": r"""import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getQueuedActions } from '../services/offlineQueue';

export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    if (!isOnline) {
      const interval = setInterval(async () => {
        const q = await getQueuedActions();
        setQueued(q.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div role="status" aria-live="polite" className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
      You're offline — actions will sync when reconnected. {queued > 0 && `(${queued} queued)`}
    </div>
  );
}""",

    "src/pages/Dashboard.jsx": r"""import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../App';
import { apiGet } from '../services/api';

export default function Dashboard() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [activeTrip, setActiveTrip] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (!user) navigate('/profile');
    else {
      apiGet('/api/trips').then(data => {
        const active = data.find(t => t.status === 'active');
        if (active) setActiveTrip(active);
        setRecent(data.filter(t => t.status !== 'active').slice(0, 5));
      }).catch(() => {});
    }
  }, [user, navigate]);

  return (
    <div className="flex-1 flex flex-col p-6 hero-gradient relative">
      <header className="mb-8 mt-4">
        <h1 className="text-4xl font-bold mb-2">SafeRoute</h1>
        <p className="text-slate-300">Your personal safety companion</p>
      </header>

      <div className="flex-1">
        {activeTrip ? (
          <div className="glass-card p-6 mb-6 border-sr-safe">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><span className="live-dot block"></span> Active Trip</h2>
            <p className="mb-4 text-slate-300">{activeTrip.origin} to {activeTrip.destination}</p>
            <Link to={`/trip/${activeTrip.id}`} className="btn-safe block text-center py-3 rounded-lg font-bold">View Trip</Link>
          </div>
        ) : (
          <div className="glass-card p-6 mb-6 text-center">
            <Link to="/routes" className="btn-info block text-center py-4 rounded-xl font-bold text-lg mb-4">Plan a Route</Link>
            <p className="text-sm text-slate-400">Share your live location and ETA securely.</p>
          </div>
        )}

        <h3 className="font-bold mb-4 text-slate-300">Recent Trips</h3>
        <div className="space-y-3">
          {recent.map(t => (
            <div key={t.id} className="glass-card p-4 text-sm flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity">
              <div>
                <p className="font-semibold">{t.destination}</p>
                <p className="text-slate-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="bg-slate-800 px-2 py-1 rounded text-xs">{t.status}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-slate-500 text-sm">No recent trips.</p>}
        </div>
      </div>

      <nav className="mt-8 flex gap-4">
        <Link to="/profile" className="flex-1 glass-card py-3 text-center text-sm font-semibold hover:bg-slate-800 transition-colors">Profile</Link>
        <Link to="/routes" className="flex-1 glass-card py-3 text-center text-sm font-semibold hover:bg-slate-800 transition-colors">Routes</Link>
      </nav>
    </div>
  );
}""",

    "src/pages/Profile.jsx": r"""import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../App';
import { apiPost } from '../services/api';

export default function Profile() {
  const { user, setUser } = useContext(UserContext);
  const [name, setName] = useState(user?.name || '');
  const navigate = useNavigate();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name) return;
    try {
      const res = await apiPost('/api/users', { name });
      localStorage.setItem('sr_session', JSON.stringify({ token: res.token, name }));
      setUser({ token: res.token, name });
      navigate('/');
    } catch (e) { alert('Failed to save profile'); }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={handleSave} className="glass-card p-8 w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6">Create Profile</h2>
          <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mb-6 focus:ring-2 focus:ring-sr-info outline-none" required />
          <button type="submit" className="btn-info w-full py-3 rounded-lg font-bold">Get Started</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Profile & Contacts</h2>
      <div className="glass-card p-6 mb-6">
        <p className="text-sm text-slate-400">Name</p>
        <p className="text-lg font-semibold">{user.name}</p>
      </div>
      <div className="glass-card p-6">
        <h3 className="font-bold mb-4">Trusted Contacts</h3>
        <p className="text-sm text-slate-400 mb-4">Contacts will be notified during emergencies.</p>
        <button className="btn-info w-full py-2 rounded-lg opacity-50 cursor-not-allowed" disabled>Add Contact (Coming Soon)</button>
      </div>
      <button onClick={() => navigate('/')} className="mt-8 bg-slate-800 w-full py-3 rounded-lg">Back to Dashboard</button>
    </div>
  );
}""",

    "src/pages/TripView.jsx": r"""import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import CheckinTimer from '../components/CheckinTimer';
import PanicButton from '../components/PanicButton';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSocket } from '../hooks/useSocket';
import { apiGet, apiPost } from '../services/api';

export default function TripView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const { position } = useGeolocation();
  const { socket } = useSocket();

  useEffect(() => {
    apiGet(`/api/trips/${id}`).then(setTrip).catch(() => navigate('/'));
  }, [id, navigate]);

  useEffect(() => {
    if (socket && trip) {
      socket.emit('trip:join', { tripId: trip.id });
    }
  }, [socket, trip]);

  useEffect(() => {
    if (socket && position && trip) {
      const interval = setInterval(() => {
        socket.emit('location:update', { tripId: trip.id, location: position });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [socket, position, trip]);

  if (!trip) return <div className="p-6">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-32">
      <div className="glass-card p-4 mb-4">
        <h2 className="font-bold text-lg">{trip.origin} → {trip.destination}</h2>
        <p className="text-sm text-slate-400">Share Link: {window.location.origin}/trip/{id}/status/{trip.shareToken || 'demo'}</p>
      </div>
      
      <MapView center={position ? [position.lat, position.lng] : null} currentLocation={position} />
      
      <div className="my-6">
        <CheckinTimer deadline={new Date(Date.now() + 15*60000).toISOString()} tripId={trip.id} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 flex justify-center pb-8 z-40">
        <PanicButton tripId={trip.id} />
      </div>
    </div>
  );
}""",

    "src/pages/ContactView.jsx": r"""import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MapView from '../components/MapView';
import AlertBanner from '../components/AlertBanner';
import { useSocket } from '../hooks/useSocket';
import { apiGet } from '../services/api';

export default function ContactView() {
  const { id, shareToken } = useParams();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const { socket } = useSocket();

  useEffect(() => {
    apiGet(`/api/trips/${id}/status/${shareToken}`)
      .then(setTrip)
      .catch(() => setError('This link has expired or is invalid.'));
  }, [id, shareToken]);

  useEffect(() => {
    if (socket && trip) {
      socket.emit('trip:join', { tripId: id, shareToken });
      socket.on('alert:new', (data) => setAlert(data));
      socket.on('location:update', (loc) => setTrip(t => ({...t, lastLocation: loc})));
    }
    return () => {
      if (socket) {
        socket.off('alert:new');
        socket.off('location:update');
      }
    };
  }, [socket, trip, id, shareToken]);

  if (error) return <div className="p-8 text-center text-slate-400">{error}</div>;
  if (!trip) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto w-full p-4">
      <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />
      
      <div className="glass-card p-6 mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">{trip.user.name}'s Trip</h1>
        <p className="text-slate-300">{trip.origin} → {trip.destination}</p>
        <span className={`inline-block mt-4 px-3 py-1 rounded-full text-sm font-bold ${trip.status === 'safe' ? 'bg-sr-safe' : 'bg-sr-danger'} text-white`}>
          Status: {trip.status.toUpperCase()}
        </span>
      </div>

      <h3 className="font-bold mb-4 px-2">Last Known Location</h3>
      <MapView center={trip.lastLocation ? [trip.lastLocation.lat, trip.lastLocation.lng] : [0,0]} currentLocation={trip.lastLocation} />
      
      <div className="mt-8 p-4 bg-slate-800 rounded-lg text-sm text-center">
        <p className="mb-2">Get notified instantly if {trip.user.name} triggers an emergency.</p>
        <button className="btn-info px-4 py-2 rounded font-bold">Enable Notifications</button>
      </div>
    </div>
  );
}""",

    "src/pages/RouteSelector.jsx": r"""import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import { apiPost } from '../services/api';

export default function RouteSelector() {
  const [scores, setScores] = useState([]);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    // Mock response for hackathon UI
    setScores([
      { id: 1, name: 'Main Boulevard', score: 85, rec: 'Safest choice', waypoints: [{lat: 34.05, lng: -118.25}, {lat: 34.06, lng: -118.24}] },
      { id: 2, name: 'Park Shortcut', score: 45, rec: 'Avoid at night', waypoints: [{lat: 34.05, lng: -118.25}, {lat: 34.06, lng: -118.26}] }
    ]);
  };

  const startTrip = async (routeId) => {
    const res = await apiPost('/api/trips', { origin: 'Current', destination: 'Home', routeId });
    navigate(`/trip/${res.id || '123'}`);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Plan Route</h2>
      <form onSubmit={handleSearch} className="glass-card p-4 mb-6 flex flex-col gap-3">
        <input type="text" placeholder="Origin" className="bg-slate-800 border-none rounded p-3" defaultValue="Current Location" />
        <input type="text" placeholder="Destination" className="bg-slate-800 border-none rounded p-3" required />
        <button type="submit" className="btn-info py-3 rounded-lg font-bold mt-2">Compare Routes</button>
      </form>

      <div className="space-y-6">
        {scores.map(route => (
          <div key={route.id} className="glass-card overflow-hidden">
            <div className="p-4 flex justify-between items-center bg-slate-800/50">
              <div>
                <h3 className="font-bold">{route.name}</h3>
                <p className="text-sm text-slate-400">{route.rec}</p>
              </div>
              <div className={`text-2xl font-bold ${route.score > 70 ? 'text-sr-safe' : 'text-sr-warning'}`}>{route.score}/100</div>
            </div>
            <div className="h-32 pointer-events-none">
              <MapView center={[route.waypoints[0].lat, route.waypoints[0].lng]} zoom={14} routeWaypoints={route.waypoints} />
            </div>
            <div className="p-4">
              <button onClick={() => startTrip(route.id)} className="w-full btn-safe py-2 rounded font-bold">Select Route</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}""",

    "src/utils/constants.js": r"""export const API_URL = '';
export const SOCKET_URL = '';
export const DEFAULT_CHECKIN_INTERVAL_MS = 900000;
export const DEFAULT_GRACE_PERIOD_MS = 300000;
export const STATUS_COLORS = { safe: 'sr-safe', warning: 'sr-warning', alert: 'sr-danger' };""",

    "src/utils/formatters.js": r"""export const formatTime = (ms) => {
  if (ms < 0) return '00:00';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins > 60) return `${Math.floor(mins/60)}h ${mins%60}m`;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (isoString) => new Date(isoString).toLocaleString();

export const formatDistance = (meters) => {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

export const getStatusIcon = (status) => ({ safe: '✅', warning: '⚠️', alert: '🚨' }[status] || 'ℹ️');
export const getStatusLabel = (status) => status.charAt(0).toUpperCase() + status.slice(1);""",

    "public/custom-sw.js": r"""self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'SafeRoute Alert', body: 'Check your safety status' };
  const options = {
    body: data.body || 'A safety alert has been triggered',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'saferoute-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification(data.title || 'SafeRoute Alert', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
  }
});"""
}

for rel_path, content in FILES.items():
    full_path = os.path.join(BASE_DIR, rel_path.replace('/', os.sep))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print(f"Created {len(FILES)} frontend files in {BASE_DIR}.")
