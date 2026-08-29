// src/components/EmailComposer/RunningSummary.tsx
import { useEffect, useState } from "react";
import { getThreadSummary } from "../../services/apiClient";

interface RunningSummaryProps {
  threadId: string | null;
}

export function RunningSummary({ threadId }: RunningSummaryProps) {
  const [summary, setSummary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ If threadId is null or undefined, clear state and return
    if (threadId === null || threadId === undefined) {
      setSummary([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadSummary() {
      setLoading(true);
      setError(null);
      try {
        // ✅ Use the non-null assertion operator (!) to tell TypeScript
        // that threadId is definitely not null here
        const result = await getThreadSummary(threadId!);
        if (isMounted) {
          setSummary(result.summary);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load summary");
          setSummary([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [threadId]);

  if (!threadId) return null;
  
  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-accent-light/5 dark:bg-accent-dark/20 p-4 animate-pulse">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
        {error}
      </div>
    );
  }
  
  if (summary.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-accent-light/5 dark:bg-accent-dark/20 p-4">
        <p className="text-sm opacity-60">No summary available for this thread.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-accent-light/5 dark:bg-accent-dark/20 p-4">
      <h3 className="text-xs uppercase tracking-wide opacity-60 mb-2 flex items-center gap-2">
        <span>📋</span> Thread Summary
      </h3>
      <ul className="space-y-1 text-sm">
        {summary.map((point, i) => (
          <li key={i} className="flex gap-2">
            <span className="opacity-50">•</span>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}