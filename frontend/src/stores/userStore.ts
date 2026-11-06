import { create } from "zustand";
import type { User } from "../types";

interface UserState {
  user: User | null;
  token: string | null;
  csrfToken: string | null;
  setSession: (user: User, token: string | null, csrfToken?: string | null) => void;
  logout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "https://ai-gmail-lw6d.onrender.com";

localStorage.removeItem("auth_token");
localStorage.removeItem("auth_user");

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  token: null,
  csrfToken: null,
  setSession: (user, token, csrfToken = null) => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    set({ user, token, csrfToken });
  },
  logout: () => {
    const csrfToken = get().csrfToken;
    fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    }).catch(() => undefined);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    set({ user: null, token: null, csrfToken: null });
  },
}));
