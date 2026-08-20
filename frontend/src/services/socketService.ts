import { io, Socket } from "socket.io-client";
import { useUserStore } from "../stores/userStore";
import { API_URL } from "./apiClient";

let socket: Socket | null = null;

// No-ops safely if there's no token yet (logged out).
export function connectSocket(): Socket | null {
  const { token } = useUserStore.getState();
  // Prefer VITE_API_URL if it's set (e.g. local dev against a
  // different backend), otherwise fall back to the same API_URL
  // apiClient.ts uses so this doesn't silently no-op in prod.
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? API_URL;
  if (!apiUrl || !token) return null;

  if (socket?.connected) return socket;
  socket = io(apiUrl, { auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}