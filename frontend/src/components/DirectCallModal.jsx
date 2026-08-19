import React, { useState, useEffect } from 'react';

export default function DirectCallModal({ isOpen, onClose, detectedKeyword, spokenText, department = "112 National Emergency & Police" }) {
  const [countdown, setCountdown] = useState(5);
  const [autoCalled, setAutoCalled] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      setAutoCalled(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!autoCalled) {
            triggerDirectCall('112');
            setAutoCalled(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, autoCalled]);

  const triggerDirectCall = (phoneNumber = '112') => {
    window.location.href = `tel:${phoneNumber}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="glass-card p-6 border-2 border-red-500 max-w-md w-full shadow-2xl text-center space-y-4 animate-pulse-short">
        <div className="inline-flex p-3 rounded-full bg-red-950/90 border border-red-500 text-3xl mb-1">
          🚨
        </div>

        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">
            CRITICAL THREAT DETECTED
          </h2>
          <p className="text-xs text-red-300 font-semibold mt-1">
            Voice AI detected serious danger keyword: <span className="bg-red-900/80 px-2 py-0.5 rounded font-mono text-white uppercase border border-red-500 font-black">"{detectedKeyword || 'EMERGENCY'}"</span>
          </p>
        </div>

        {spokenText && (
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-left">
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Spoken Transcript:</span>
            <p className="text-xs text-slate-200 italic">"{spokenText}"</p>
          </div>
        )}

        <div className="bg-red-950/60 p-4 rounded-xl border border-red-500/60 space-y-2">
          <p className="text-xs text-slate-300">
            Auto-dialing Emergency Police Helpline (<strong className="text-white">112</strong>) in:
          </p>
          <div className="text-4xl font-black text-red-400 font-mono">
            00:0{countdown}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <a
            href="tel:112"
            onClick={() => triggerDirectCall('112')}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all border border-red-400"
          >
            <span>📞</span> DIRECT CALL POLICE (112) NOW
          </a>

          <a
            href={`tel:${localStorage.getItem('sr_parent_phone') || '+1234567890'}`}
            onClick={() => triggerDirectCall(localStorage.getItem('sr_parent_phone') || '+1234567890')}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl border border-emerald-400"
          >
            <span>👨‍👩‍👧</span> CALL PARENT / GUARDIAN ({localStorage.getItem('sr_parent_phone') || '+1234567890'})
          </a>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="tel:100"
              onClick={() => triggerDirectCall('100')}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border border-slate-700"
            >
              <span>🚓</span> Police (100)
            </a>
            <a
              href="tel:1091"
              onClick={() => triggerDirectCall('1091')}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border border-slate-700"
            >
              <span>👩</span> Women (1091)
            </a>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Cancel Direct Call
          </button>
        </div>
      </div>
    </div>
  );
}
