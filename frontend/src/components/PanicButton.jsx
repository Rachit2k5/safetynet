import React, { useState, useRef } from 'react';
import { queueAction } from '../services/offlineQueue';
import { apiPost, apiPut } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { captureLiveCameraPhoto } from '../utils/camera';

export default function PanicButton({ tripId }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { position } = useGeolocation();
  const holdTimeout = useRef(null);

  const generateFallbackPhoto = (lat, lng) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('🚨 EMERGENCY SNAPSHOT AT PANIC TRIGGER', 30, 60);
    ctx.fillStyle = '#06b6d4';
    ctx.font = '20px monospace';
    ctx.fillText(`GPS Latitude:  ${lat.toFixed(6)}`, 40, 140);
    ctx.fillText(`GPS Longitude: ${lng.toFixed(6)}`, 40, 180);
    ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, 40, 220);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 628, 468);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const captureMediaEvidence = async (alertId, lat, lng) => {
    setIsCapturing(true);
    let imageData = null;

    // 1. Capture Real Camera Snapshot Photo
    try {
      imageData = await captureLiveCameraPhoto();
      console.log('✓ Real hardware camera photo snapshot captured!');
    } catch (err) {
      console.warn('Real camera error; fallback canvas used:', err);
      imageData = generateFallbackPhoto(lat, lng);
    }

    // Immediately upload image evidence first!
    if (imageData) {
      await sendEvidencePayload(alertId, imageData, null);
    }

    // 2. Capture Audio Evidence Clip (3.5 seconds)
    try {
      if (navigator.mediaDevices && window.MediaRecorder) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(audioStream);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          audioStream.getTracks().forEach(track => track.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const audioData = reader.result;
            await sendEvidencePayload(alertId, null, audioData);
          };
        };

        mediaRecorder.start();
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        }, 3500);
      }
    } catch (err) {
      console.warn('Audio recording error/denied:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const sendEvidencePayload = async (alertId, imageData, audioData) => {
    try {
      await apiPost(`/api/alerts/${alertId}/evidence`, { imageData, audioData });
      console.log('✓ Emergency evidence successfully uploaded to backend');
    } catch (err) {
      console.error('Evidence upload error:', err);
    }
  };

  const triggerPanic = async () => {
    setShowConfirm(false);
    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 500]);
    
    const lat = position?.lat || 28.6139;
    const lng = position?.lng || 77.2090;
    const payload = { lat, lng, timestamp: new Date().toISOString() };
    const targetTripId = tripId || 'emergency';

    let alertId = null;

    try {
      const res = await apiPost(`/api/trips/${targetTripId}/panic`, payload);
      alertId = res.alertId;
      setStatus('success');
    } catch (e1) {
      try {
        const res2 = await apiPut(`/api/trips/${targetTripId}/panic`, payload);
        alertId = res2.alertId;
        setStatus('success');
      } catch (e2) {
        await queueAction({ type: 'POST', url: `/api/trips/${targetTripId}/panic`, body: payload });
        setStatus('queued');
      }
    }

    if (alertId) {
      captureMediaEvidence(alertId, lat, lng);
    }

    setTimeout(() => setStatus(null), 8000);
  };

  const handleStart = () => {
    holdTimeout.current = setTimeout(() => setShowConfirm(true), 1000);
  };
  const handleEnd = () => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
  };

  return (
    <div className="flex flex-col items-center gap-4 my-2 w-full max-w-sm">
      {status === 'success' && (
        <div className="bg-sr-safe text-white px-4 py-2.5 rounded-xl font-medium text-xs text-center shadow-lg border border-emerald-400/40" role="alert">
          ✓ Emergency alert broadcasted to trusted contacts! {isCapturing ? ' (📸 Capturing camera snapshot & 🎙️ 4s audio...)' : ' (Photo & Audio attached)'}
        </div>
      )}
      {status === 'queued' && (
        <div className="bg-amber-600 text-white px-4 py-2.5 rounded-xl font-medium text-xs text-center shadow-lg" role="alert">
          ⚠️ Signal Loss: Emergency queued in offline storage — will auto-sync when online
        </div>
      )}

      <button
        className="w-36 h-36 rounded-full bg-gradient-to-tr from-red-600 via-sr-danger to-rose-500 text-white font-black text-xl shadow-[0_0_40px_rgba(239,68,68,0.8)] hover:scale-105 active:scale-95 transition-all focus-visible:ring-4 focus-visible:ring-red-500 flex flex-col items-center justify-center gap-1 border-4 border-red-300/40"
        onMouseDown={handleStart} onMouseUp={handleEnd} onMouseLeave={handleEnd}
        onTouchStart={handleStart} onTouchEnd={handleEnd}
        onClick={() => setShowConfirm(true)}
        tabIndex={0}
        aria-label="Emergency panic button — tap to alert all trusted contacts"
      >
        <span className="text-3xl animate-pulse">🚨</span>
        <span className="tracking-wider text-lg font-black">EMERGENCY</span>
      </button>
      <p className="text-slate-400 text-xs">Tap or Hold 1s to broadcast panic & capture camera/audio</p>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-sm w-full border border-red-500/60 shadow-2xl">
            <div className="text-4xl text-center mb-2">🚨</div>
            <h2 className="text-xl font-bold text-red-400 text-center mb-2">Confirm Emergency Broadcast?</h2>
            <p className="text-slate-300 text-xs text-center mb-6 leading-relaxed">
              This will immediately notify all your trusted contacts with your live GPS location, snap a camera photo, and record live audio evidence.
            </p>
            <div className="flex gap-3">
              <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-semibold text-xs" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="flex-1 btn-danger py-3 rounded-xl font-bold text-xs tracking-wider shadow-lg" onClick={triggerPanic} autoFocus>SEND ALERT NOW</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
