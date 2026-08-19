import React, { useState, useEffect, useRef } from 'react';
import { apiPut } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

export default function CheckinTimer({ deadline, tripId, intervalMs = 900000, onCheckinSuccess, onAutoPanicTrigger }) {
  const [targetTime, setTargetTime] = useState(() => {
    const d = deadline ? new Date(deadline).getTime() : 0;
    return (d > Date.now()) ? d : Date.now() + intervalMs;
  });
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, targetTime - Date.now()));
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('safe');
  const [isListening, setIsListening] = useState(false);
  const [distressAlert, setDistressAlert] = useState(null);
  const { position } = useGeolocation();
  const recognitionRef = useRef(null);

  // Synchronize target time when deadline prop updates
  useEffect(() => {
    if (deadline) {
      const d = new Date(deadline).getTime();
      if (!isNaN(d) && d > Date.now()) {
        setTargetTime(d);
      }
    }
  }, [deadline]);

  // Real-time 1-second countdown tick
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, targetTime - Date.now());
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  const triggerVoiceEmergency = (keyword) => {
    setDistressAlert(`🚨 Voice AI Emergency Triggered! Spoken Keyword: "${keyword.toUpperCase()}". Auto-broadcasting Emergency Alert...`);
    if (onAutoPanicTrigger) {
      onAutoPanicTrigger();
    }
  };

  const handleVoiceCheckin = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech API is not natively active in this browser. Use manual check-in form below.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join(' ')
        .toLowerCase();

      setMessage(transcript);

      const emergencyKeywords = ['help', 'danger', 'emergency', 'save me', 'following me', 'attack', 'stop'];
      const detected = emergencyKeywords.find(kw => transcript.includes(kw));

      if (detected) {
        recognition.stop();
        setIsListening(false);
        triggerVoiceEmergency(detected);
      }
    };

    recognition.start();
  };

  const handleCheckin = async (e) => {
    e.preventDefault();
    setDistressAlert(null);
    try {
      const res = await apiPut(`/api/trips/${tripId}/checkin`, {
        status: 'safe',
        message: message || 'I am safe',
        lat: position?.lat || 28.6139,
        lng: position?.lng || 77.2090
      });

      // Reset target countdown time to future interval (15 mins)
      const nextTarget = Date.now() + intervalMs;
      setTargetTime(nextTarget);
      setTimeLeft(intervalMs);

      if (res.details?.contradictionFlag) {
        setDistressAlert('⚠️ Warning: Latent distress keywords detected in your message. A soft alert has been raised to your contacts.');
      } else {
        setMessage('');
        setStatus('confirmed');
        setTimeout(() => setStatus('safe'), 3000);
      }
      if (onCheckinSuccess) onCheckinSuccess();
    } catch (err) {
      console.error('Check-in error:', err);
    }
  };

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isOverdue = timeLeft === 0;

  return (
    <div className="glass-card p-6 border border-slate-700 text-center relative overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">Next Scheduled Check-in</h3>
        <button
          type="button"
          onClick={handleVoiceCheckin}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${isListening ? 'bg-red-600 animate-pulse text-white shadow-lg' : 'bg-slate-800 text-sr-info border border-slate-700 hover:bg-slate-700'}`}
        >
          <span>🎙️</span> {isListening ? 'Voice AI Listening (Say "HELP")...' : 'Voice AI Monitor'}
        </button>
      </div>

      <div className={`text-4xl font-black font-mono my-3 transition-colors ${isOverdue ? 'text-red-500 animate-pulse' : 'text-white'}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>

      {isOverdue && (
        <div className="bg-red-950/90 border border-red-500 text-red-300 p-2.5 rounded-xl text-xs font-bold mb-4 shadow text-center">
          🚨 CHECK-IN OVERDUE! Confirm safety below to clear alert state.
        </div>
      )}

      {distressAlert && (
        <div className="bg-red-950/90 border border-red-500 text-red-200 p-3 rounded-xl text-xs mb-4 text-left leading-relaxed shadow-lg" role="alert">
          {distressAlert}
        </div>
      )}

      {status === 'confirmed' && (
        <div className="bg-sr-safe text-white p-2.5 rounded-xl text-xs font-bold mb-4 shadow">
          ✓ Check-in Confirmed! Timer reset for next interval.
        </div>
      )}

      <form onSubmit={handleCheckin} className="space-y-3 mt-4">
        <input
          type="text"
          placeholder="Optional check-in note or speak aloud..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:ring-2 focus:ring-sr-info"
        />

        <button type="submit" className="btn-safe w-full py-3 rounded-xl font-bold text-sm shadow-lg hover:brightness-110 transition-all">
          ✓ I'M SAFE — CONFIRM CHECK-IN
        </button>
      </form>
    </div>
  );
}
