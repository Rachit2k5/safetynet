import { useState, useEffect } from 'react';

export const useGeolocation = (options = { highAccuracy: true, maxAge: 10000, timeout: 5000 }) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }
    setIsTracking(true);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { enableHighAccuracy: options.highAccuracy, maximumAge: options.maxAge, timeout: options.timeout }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsTracking(false);
    };
  }, [options.highAccuracy, options.maxAge, options.timeout]);

  return { position, error, isTracking };
};
