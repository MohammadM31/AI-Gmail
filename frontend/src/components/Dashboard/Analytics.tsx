import { useEffect, useState } from "react";
import { UsageStats } from "./UsageStats";
import { getTopics } from "../../services/apiClient";

export function Analytics() {
  const [topics, setTopics] = useState<string[]>([]);

  useEffect(() => {
    getTopics().then((r) => setTopics(r.topics)).catch(() => {});
  }, []);

  function exportCsv() {
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (apiUrl) window.open(`${apiUrl}/api/analytics/export`, "_blank");
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
