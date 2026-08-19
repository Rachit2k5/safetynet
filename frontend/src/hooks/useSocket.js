import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let s;
    try {
      s = io(SOCKET_URL || '', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnectionAttempts: 5
      });
      s.on('connect', () => setIsConnected(true));
      s.on('disconnect', () => setIsConnected(false));
      s.on('connect_error', (err) => {
        console.warn('Socket connection error (continuing gracefully):', err?.message || err);
        setIsConnected(false);
      });
      setSocket(s);
    } catch (e) {
      console.warn('Failed to initialize socket:', e);
    }

    return () => {
      if (s) {
        try { s.disconnect(); } catch (e) {}
      }
    };
  }, []);

  return { socket, isConnected };
};
