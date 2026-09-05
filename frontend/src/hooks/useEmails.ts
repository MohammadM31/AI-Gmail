// frontend/src/hooks/useEmails.ts
import { useCallback, useEffect, useState } from "react";
import type { EmailItem } from "../types";
import * as api from "../services/apiClient";

export function useEmails(query?: string, autoRefreshInterval: number = 30000) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await api.listEmails(query);
      setEmails(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // ✅ Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, autoRefreshInterval);
    
    return () => clearInterval(interval);
  }, [load, autoRefreshInterval]);

  return { emails, loading, error, reload: load };
}