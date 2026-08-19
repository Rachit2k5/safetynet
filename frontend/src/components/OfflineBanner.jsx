import React, { useEffect, useState } from 'react';
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
}
