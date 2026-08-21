import { useEffect, useState } from "react";
import { getUsage } from "../../services/apiClient";

const LABELS: Record<string, string> = {
  ai_call: "AI calls",
  email_sent: "Emails sent",
  voice_used: "Voice inputs",
  chart_generated: "Charts generated",
};

interface UsageStatsProps {
  dateFrom?: string;
  dateTo?: string;
}

export function UsageStats({ dateFrom, dateTo }: UsageStatsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params: { dateFrom?: string; dateTo?: string } = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const data = await getUsage(params);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage stats");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(LABELS).map(([key, label]) => (
          <div
            key={key}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 text-center animate-pulse"
          >
            <div className="h-8 w-12 mx-auto bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-16 mx-auto mt-1 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-highlight">
        {error} <button className="underline" onClick={load}>Retry</button>
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Object.entries(LABELS).map(([key, label]) => (
        <div
          key={key}
          className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 text-center"
        >
          <div className="text-2xl font-semibold">{counts[key] ?? 0}</div>
          <div className="text-xs opacity-60 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}