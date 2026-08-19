import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import CheckinTimer from '../components/CheckinTimer';
import PanicButton from '../components/PanicButton';
import ContinuousVoiceTracker from '../components/ContinuousVoiceTracker';
import VideoCaptureButton from '../components/VideoCaptureButton';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSocket } from '../hooks/useSocket';
import { apiGet, apiPut, apiPost } from '../services/api';

export default function TripView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [voiceAlertMessage, setVoiceAlertMessage] = useState(null);
  const { position } = useGeolocation();
  const { socket } = useSocket();

  useEffect(() => {
    apiGet(`/api/trips/${id}`).then(data => {
      setTrip(data);
      if (data.share_token || data.shareToken) {
        const token = data.share_token || data.shareToken;
        setShareUrl(`${window.location.origin}/trip/${id}/status/${token}`);
      }
    }).catch(() => navigate('/'));
  }, [id, navigate]);

  useEffect(() => {
    if (socket && trip) {
      socket.emit('trip:join', trip.id);
    }
  }, [socket, trip]);

  useEffect(() => {
    if (socket && position && trip) {
      const interval = setInterval(() => {
        socket.emit('location:send', { tripId: trip.id, lat: position.lat, lng: position.lng });
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [socket, position, trip]);

  const handleCompleteTrip = async () => {
    try {
      await apiPut(`/api/trips/${id}/complete`, {});
      navigate('/');
    } catch (err) {
      alert('Failed to complete trip');
    }
  };

  const copyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleAutoPanicTrigger = async (spokenText = '') => {
    setVoiceAlertMessage(`🚨 Voice AI Emergency Triggered! ("${spokenText}"). Auto-broadcasting panic alert with photo & audio evidence...`);
    const lat = position?.lat || 28.6139;
    const lng = position?.lng || 77.2090;
    try {
      await apiPost(`/api/trips/${id}/panic`, { lat, lng });
    } catch (err) {
      await apiPut(`/api/trips/${id}/panic`, { lat, lng });
    }
    setTimeout(() => setVoiceAlertMessage(null), 8000);
  };

  if (!trip) return <div className="p-6 text-center">Loading Trip...</div>;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-40 relative min-h-screen max-w-2xl mx-auto w-full">
      {voiceAlertMessage && (
        <div className="bg-red-950 border border-red-500 text-red-200 p-3.5 rounded-xl text-xs mb-4 text-center font-bold animate-pulse shadow-2xl">
          {voiceAlertMessage}
        </div>
      )}

      <div className="glass-card p-4 mb-4 border border-slate-700/80 shadow-xl">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="font-bold text-lg text-white">{trip.origin} → {trip.destination}</h2>
            <p className="text-xs text-slate-400">Started at: {new Date(trip.started_at).toLocaleTimeString()}</p>
          </div>
          <button onClick={handleCompleteTrip} className="btn-safe text-xs px-3 py-1.5 rounded-xl font-bold shadow">
            End Trip Safely
          </button>
        </div>

        {shareUrl && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400 truncate max-w-[240px] font-mono">{shareUrl}</span>
            <button onClick={copyShareLink} className="text-xs bg-slate-800 hover:bg-slate-700 text-sr-info px-3 py-1 rounded-lg border border-slate-700 font-semibold whitespace-nowrap">
              {copied ? '✓ Copied!' : 'Copy Contact Link'}
            </button>
          </div>
        )}
      </div>

      <div className="h-64 rounded-2xl overflow-hidden mb-4 border border-slate-700/80 shadow-xl">
        <MapView 
          center={position ? [position.lat, position.lng] : [trip.origin_lat || 28.6139, trip.origin_lng || 77.2090]} 
          currentLocation={position} 
        />
      </div>

      {/* Incident Camera Video Recorder */}
      <div className="my-3">
        <VideoCaptureButton tripId={trip.id} />
      </div>

      {/* Real-Time Continuous AI Voice Tracker with Timestamps */}
      <ContinuousVoiceTracker tripId={trip.id} onEmergencyDetected={handleAutoPanicTrigger} />

      <div className="my-2">
        <CheckinTimer 
          deadline={trip.expected_arrival || new Date(Date.now() + 15*60000).toISOString()} 
          tripId={trip.id} 
          onAutoPanicTrigger={handleAutoPanicTrigger}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 p-4 flex justify-center pb-6 z-40">
        <PanicButton tripId={trip.id} />
      </div>
    </div>
  );
}
