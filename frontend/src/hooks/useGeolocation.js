import { useState, useEffect } from 'react';

export const useGeolocation = (options = { highAccuracy: true, maxAge: 10000, timeout: 5000 }) => {
  // Always initialize with default GPS position so components never stall or render blank
  const [position, setPosition] = useState({ lat: 28.6139, lng: 77.2090 });
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError('Geolocation not supported on this device/browser');
      return;
    }

    setIsTracking(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos && pos.coords) {
          setPosition({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setError(null);
        }
      },
      (err) => {
        console.warn('Geolocation warning:', err?.message || err);
        setError(err?.message || 'Location access unavailable');
      },
      {
        enableHighAccuracy: options.highAccuracy,
        maximumAge: options.maxAge,
        timeout: options.timeout
      }
    );

    return () => {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch (e) {}
      setIsTracking(false);
    };
  }, [options.highAccuracy, options.maxAge, options.timeout]);

  return { position, error, isTracking };
};
