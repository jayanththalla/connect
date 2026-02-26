'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com';
      socket = io(apiUrl, {
        path: '/api/socket',
        addTrailingSlash: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
      });
    }

    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      // Register userId with socket server for presence tracking
      if (userId && socket) {
        socket.emit('user-connected', userId);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // If already connected, emit user-connected immediately
    if (socket.connected && userId) {
      socket.emit('user-connected', userId);
      setIsConnected(true);
    }

    return () => {
      socket?.off('connect', handleConnect);
      socket?.off('disconnect', handleDisconnect);
    };
  }, [userId]);

  return { socket: socketRef.current, isConnected };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
