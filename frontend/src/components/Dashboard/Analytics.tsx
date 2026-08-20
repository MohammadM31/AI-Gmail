import { useEffect, useState } from "react";
import { UsageStats } from "./UsageStats";
import { getTopics, API_URL } from "../../services/apiClient";
import { useUserStore } from "../../stores/userStore";

export function Analytics() {
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getTopics();
      setTopics(r.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    // The export route is behind requireAuth, and window.open() can't
    // send an Authorization header, so fetch it with the token and
    // trigger the download from the resulting blob instead.
    const token = useUserStore.getState().token;
    try {
      const res = await fetch(`${API_URL}/api/analytics/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analytics.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export CSV");
    }
  }

  return (
    <div className="space-y-6">
      <UsageStats />

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Frequent topics</h3>
          <button onClick={exportCsv} className="text-xs underline opacity-70 hover:opacity-100">
            Export CSV
          </button>
        </div>
        {loading && <p className="text-sm opacity-60">Loading…</p>}
        {error && (
          <p className="text-sm text-highlight">
            {error} <button className="underline" onClick={load}>Retry</button>
          </p>
        )}
        {!loading && !error && topics.length === 0 && (
          <p className="text-sm opacity-60">Send a few emails and topics will show up here.</p>
        )}
        <ul className="space-y-1 text-sm">
          {topics.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="opacity-50">•</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}