import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { createContext, useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import TripView from './pages/TripView';
import ContactView from './pages/ContactView';
import RouteSelector from './pages/RouteSelector';
import ParentPortal from './pages/ParentPortal';
import PWAPrompt from './components/PWAPrompt';
import OfflineBanner from './components/OfflineBanner';
import ErrorBoundary from './components/ErrorBoundary';

export const UserContext = createContext(null);

export default function App() {
  const [user, setUser] = useState(null);
  const [userReady, setUserReady] = useState(false);
  const [aspectMode, setAspectMode] = useState('auto'); // 'auto', 'mobile', 'full'

  useEffect(() => {
    const stored = localStorage.getItem('sr_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setUser(parsed);
        } else {
          initDefaultUser();
        }
      } catch (e) {
        initDefaultUser();
      }
    } else {
      initDefaultUser();
    }
    setUserReady(true);
  }, []);

  const initDefaultUser = () => {
    const defaultUser = {
      id: 'demo-user-id',
      name: 'Safe Traveler',
      email: 'traveler@saferoute.app',
      parent_pin: '1234'
    };
    try {
      localStorage.setItem('sr_session', JSON.stringify(defaultUser));
    } catch (e) {}
    setUser(defaultUser);
  };

  // Don't render routes until user state is resolved to prevent flash/redirect loops
  if (!userReady) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading SafeRoute...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <UserContext.Provider value={{ user, setUser }}>
        <BrowserRouter>
          <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-0 md:p-4 transition-all">
            <OfflineBanner />

            {/* Desktop Responsive Device Aspect-Ratio Shell Toggle */}
            <div className="hidden md:flex items-center justify-between w-full max-w-4xl px-4 py-2 text-xs text-slate-400 border-b border-slate-800/80 mb-2">
              <div className="flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-white">SafeRoute Mobile PWA</span>
                <span>• Auto-Adjusting Aspect Ratio Active</span>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setAspectMode('auto')} 
                  className={`px-3 py-1 rounded-lg border font-semibold transition-all ${aspectMode === 'auto' ? 'bg-sr-info text-white border-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  📱 Mobile Frame
                </button>
                <button 
                  onClick={() => setAspectMode('full')} 
                  className={`px-3 py-1 rounded-lg border font-semibold transition-all ${aspectMode === 'full' ? 'bg-sr-info text-white border-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  🖥️ Full Screen
                </button>
              </div>
            </div>

            {/* App Container with Auto-Adjusting Mobile Device Aspect Ratio */}
            <div className={`w-full transition-all duration-300 ${aspectMode === 'full' ? 'max-w-5xl' : 'max-w-md md:rounded-[40px] md:border-4 md:border-slate-800 md:shadow-[0_0_50px_rgba(0,0,0,0.8)] md:my-2'} bg-[#0a0e1a] min-h-screen relative overflow-y-auto flex flex-col`}>
              
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/trip/:id" element={<TripView />} />
                <Route path="/trip/:id/status/:shareToken" element={<ContactView />} />
                <Route path="/routes" element={<RouteSelector />} />
                <Route path="/parent" element={<ParentPortal />} />
              </Routes>

              <PWAPrompt />
            </div>
          </div>
        </BrowserRouter>
      </UserContext.Provider>
    </ErrorBoundary>
  );
}
