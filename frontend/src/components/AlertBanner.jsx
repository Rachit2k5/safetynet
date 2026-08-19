import React, { useEffect, useRef } from 'react';
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
}
