import React from 'react';
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
}
