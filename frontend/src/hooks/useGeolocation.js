import { useState, useEffect } from 'react';

export const useGeolocation = (options = { highAccuracy: true, maxAge: 10000, timeout: 5000 }) => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // 1. Instant IP-based Geolocation Fallback so location is never stuck on default Delhi
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          setPosition(prev => prev || { lat: data.latitude, lng: data.longitude, isIpFallback: true });
        }
      })
      .catch(() => {});

    // 2. High-Accuracy Hardware Device GPS Tracker
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }
    setIsTracking(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, isHardware: true });
        setError(null);
      },
      (err) => {
        console.warn('Hardware GPS error/timeout:', err.message);
        setError(err.message);
      },
      { enableHighAccuracy: options.highAccuracy, maximumAge: options.maxAge, timeout: options.timeout }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setIsTracking(false);
    };
  }, [options.highAccuracy, options.maxAge, options.timeout]);

  return { position, error, isTracking };
};
