export function RunningSummary({ summary }: { summary: string[] }) {
  if (!summary.length) return null;
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-accent-light/5 dark:bg-accent-dark/20 p-4">
      <h3 className="text-xs uppercase tracking-wide opacity-60 mb-2">Thread summary</h3>
      <ul className="space-y-1 text-sm">
        {summary.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="opacity-50">•</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
