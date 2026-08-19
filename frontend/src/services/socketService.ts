import { io, Socket } from "socket.io-client";
import { useUserStore } from "../stores/userStore";

let socket: Socket | null = null;

// No-ops safely if there's no backend/token yet (mock mode).
export function connectSocket(): Socket | null {
  const { token } = useUserStore.getState();
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!apiUrl || !token) return null;

  if (socket?.connected) return socket;
  socket = io(apiUrl, { auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}
