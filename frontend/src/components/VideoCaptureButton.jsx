import React, { useState, useRef, useEffect } from 'react';
import { apiPost } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';

export default function VideoCaptureButton({ tripId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'uploading', 'success', 'error'
  const [statusMsg, setStatusMsg] = useState('');
  const { position } = useGeolocation();

  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const isCancelledRef = useRef(false);

  const startCameraAndRecording = async () => {
    setIsOpen(true);
    setUploadStatus(null);
    setStatusMsg('');
    chunksRef.current = [];
    isCancelledRef.current = false;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Initialize MediaRecorder
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (isCancelledRef.current) {
          console.log('Video recording cancelled by user. Upload aborted.');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await processAndUploadVideo(blob);
      };

      mediaRecorder.start(500); // chunk slice
      setIsRecording(true);
      setRecordTime(0);

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordTime(prev => {
          if (prev >= 15) { // Auto-stop at 15 seconds max
            stopRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Camera video recording error:', err);
      setStatusMsg('Camera/Microphone permission denied or not available.');
      setUploadStatus('error');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    stopRecording();
    setIsOpen(false);
    setUploadStatus(null);
    setStatusMsg('');
  };

  const processAndUploadVideo = async (videoBlob) => {
    setUploadStatus('uploading');
    setStatusMsg('Encrypting & uploading live video evidence...');

    const reader = new FileReader();
    reader.readAsDataURL(videoBlob);
    reader.onloadend = async () => {
      const base64Video = reader.result;
      const lat = position?.lat || 28.6139;
      const lng = position?.lng || 77.2090;
      const targetTripId = tripId || 'emergency';

      try {
        // 1. Create Panic Alert
        const panicRes = await apiPost(`/api/trips/${targetTripId}/panic`, {
          lat,
          lng,
          aiReport: `[INCIDENT VIDEO RECORDED - ${new Date().toLocaleTimeString()}]\nUser manually recorded a ${recordTime}s live video clip of suspect/incident.`
        });

        const alertId = panicRes.alertId;

        // 2. Upload Video Evidence
        if (alertId && base64Video) {
          await apiPost(`/api/alerts/${alertId}/evidence`, { videoData: base64Video });
        }

        setUploadStatus('success');
        setStatusMsg('✓ Incident Video Successfully Uploaded & Email Alert Sent to Trusted Contacts!');
        setTimeout(() => {
          setIsOpen(false);
          setUploadStatus(null);
        }, 3000);
      } catch (err) {
        console.error('Failed to upload video evidence:', err);
        setUploadStatus('error');
        setStatusMsg('Failed to upload video. Please check internet connection.');
      }
    };
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={startCameraAndRecording}
        className="w-full bg-slate-900/90 hover:bg-slate-800 text-rose-300 border border-rose-500/50 hover:border-rose-400 p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all group"
      >
        <span className="text-base group-hover:scale-110 transition-transform">🎥</span>
        <span>Record Live Incident Video</span>
        <span className="bg-rose-950 text-rose-300 text-[10px] px-2 py-0.5 rounded border border-rose-800/40 ml-auto font-mono">
          REC
        </span>
      </button>

      {/* Camera Video Recorder Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="glass-card p-5 max-w-md w-full border border-rose-500/60 shadow-2xl space-y-4">
            {/* Header Status */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
                <h3 className="font-black text-sm text-white uppercase tracking-wider">
                  {isRecording ? `Recording Video (${recordTime}s / 15s)` : 'Incident Video Capture'}
                </h3>
              </div>
              <button
                type="button"
                onClick={cancelRecording}
                className="text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Live Camera Viewfinder */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {isRecording && (
                <div className="absolute top-3 left-3 bg-red-950/90 border border-red-500 text-red-100 text-[11px] font-mono px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>REC 00:{recordTime < 10 ? `0${recordTime}` : recordTime}</span>
                </div>
              )}

              {uploadStatus === 'uploading' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-xs font-bold gap-2 p-4 text-center">
                  <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  <span>Uploading Incident Video Evidence...</span>
                </div>
              )}
            </div>

            {/* Status Messages */}
            {statusMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium text-center ${uploadStatus === 'success' ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500' : uploadStatus === 'error' ? 'bg-red-950/90 text-red-200 border border-red-500' : 'bg-slate-900 text-slate-300'}`}>
                {statusMsg}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg flex items-center justify-center gap-2"
                >
                  <span>⏹</span>
                  <span>Stop & Upload Incident Video</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-xs"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
