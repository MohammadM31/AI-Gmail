import { useEffect, useState } from "react";
import type { EmailItem } from "../../types";
import { listEmails } from "../../services/apiClient";

interface EmailListProps {
  onSelect: (email: EmailItem) => void;
}

export function EmailList({ onSelect }: EmailListProps) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const { items } = await listEmails(q);
      setEmails(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
        placeholder="Search emails…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load(query)}
      />

      {loading && <p className="text-sm opacity-60">Loading…</p>}
      {error && (
        <p className="text-sm text-highlight">
          {error} <button className="underline" onClick={() => load(query)}>Retry</button>
        </p>
      )}
      {!loading && !error && emails.length === 0 && (
        <p className="text-sm opacity-60">No emails yet — compose one to get started.</p>
      )}

      <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden">
        {emails.map((email) => (
          <li key={email.id}>
            <button
              onClick={() => onSelect(email)}
              className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{email.subject}</span>
                <span className="text-xs opacity-50 capitalize">{email.status}</span>
              </div>
              <div className="text-xs opacity-60 mt-1">
                {email.recipients.map((r) => r.name).join(", ")}
              </div>
              <p className="text-xs opacity-60 mt-1 line-clamp-1">
                {email.bulletPoints[0] ?? email.content}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}