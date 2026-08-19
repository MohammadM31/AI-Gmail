import { useEffect, useState } from "react";
import { getUsage } from "../../services/apiClient";

const LABELS: Record<string, string> = {
  ai_call: "AI calls",
  email_sent: "Emails sent",
  voice_used: "Voice inputs",
  chart_generated: "Charts generated",
};

export function UsageStats() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getUsage().then((r) => setCounts(r.counts)).catch(() => {});
  }, []);

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
