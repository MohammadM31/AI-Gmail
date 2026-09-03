// frontend/src/services/socketService.ts
import { io, Socket } from "socket.io-client";
import { useUserStore } from "../stores/userStore";
import { API_URL } from "./apiClient";

let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  const { token } = useUserStore.getState();
  const apiUrl = import.meta.env.VITE_API_URL ?? API_URL;
  if (!apiUrl || !token) return null;

  if (socket?.connected) return socket;
  
  socket = io(apiUrl, { 
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
    timeout: 20000,
  });
  
  socket.on('connect', () => {
    console.log('🔌 Socket connected');
  });
  
  socket.on('connect_error', (err) => {
    console.warn('⚠️ Socket connection error:', err.message);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Reconnect manually
      socket?.connect();
    }
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
  });
  
  socket.on('reconnect_error', (err) => {
    console.warn('⚠️ Socket reconnection error:', err.message);
  });
  
  socket.on('reconnect_failed', () => {
    console.warn('❌ Socket reconnection failed');
  });
  
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Socket disconnected manually');
  }
}