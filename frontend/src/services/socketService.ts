// frontend/src/services/socketService.ts
import { io, Socket } from "socket.io-client";
import { useUserStore } from "../stores/userStore";
import { API_URL } from "./apiClient";

let socket: Socket | null = null;

export type MailEvent =
  | { type: "received"; id: string; subject?: string }
  | { type: "sent"; id: string; senderId?: string };

const mailListeners = new Set<(event: MailEvent) => void>();

// Fan socket mail events out to any number of subscribers (App toast,
// EmailList refresh) so nobody needs a second connection or their own socket.on.
export function onMailEvent(listener: (event: MailEvent) => void): () => void {
  mailListeners.add(listener);
  return () => {
    mailListeners.delete(listener);
  };
}

function emitMailEvent(event: MailEvent) {
  mailListeners.forEach((listener) => listener(event));
}

export function connectSocket(): Socket | null {
  const { user } = useUserStore.getState();
  const apiUrl = import.meta.env.VITE_API_URL ?? API_URL;
  if (!apiUrl || !user) return null;

  // Reuse the socket even while it is still connecting or reconnecting.
  if (socket) return socket;

  socket = io(apiUrl, {
    withCredentials: true,
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

  socket.on("email:received", (payload: { id: string; subject?: string }) => {
    emitMailEvent({ ...payload, type: "received" });
  });

  socket.on("email:sent", (payload: { id: string; senderId?: string }) => {
    emitMailEvent({ ...payload, type: "sent" });
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