import { useCallback, useEffect, useState } from "react";
import type { EmailItem } from "../types";
import * as api from "../services/apiClient";

export function useEmails(query?: string) {
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

  return { emails, loading, error, reload: load };
}
