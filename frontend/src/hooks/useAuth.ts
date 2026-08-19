import { useState } from "react";
import { useUserStore } from "../stores/userStore";
import * as api from "../services/apiClient";

export function useAuth() {
  const { user, setSession, logout } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      if (api.USE_MOCK) {
        // Demo mode: skip real auth, just create a local session.
        setSession(
          { id: "demo-user", email, name: email.split("@")[0], organizationId: "demo-org" },
          "demo-token"
        );
        return;
      }
      const { user: loggedInUser, token } = await api.login(email, password);
      setSession(loggedInUser, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  // Provide organizationName to create a new org, or inviteCode to
  // join an existing one.
  async function signUp(input: {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
    inviteCode?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      if (api.USE_MOCK) {
        setSession(
          {
            id: "demo-user",
            email: input.email,
            name: input.name,
            organizationId: "demo-org",
          },
          "demo-token"
        );
        return;
      }
      const { user: newUser, token } = await api.register(input);
      setSession(newUser, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return { user, loading, error, signIn, signUp, signOut: logout };
}
