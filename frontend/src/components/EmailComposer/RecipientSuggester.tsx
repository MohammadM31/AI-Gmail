import { useEffect, useState } from "react";
import type { Contact } from "../../types";
import { listContacts } from "../../services/apiClient";

interface Props {
  selected: { name: string; email: string | null }[];
  onChange: (recipients: { name: string; email: string | null }[]) => void;
}

export function RecipientSuggester({ selected, onChange }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listContacts().then(setContacts).catch(() => {});
  }, []);

  const suggestions = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      !selected.some((s) => s.email === c.email)
  );

  function addFreeText() {
    if (!query.trim()) return;
    onChange([...selected, { name: query, email: null }]);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map((r, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-accent-light/10 dark:bg-accent-dark/40 px-3 py-1 text-xs"
          >
            {r.name}
            <button
              onClick={() => onChange(selected.filter((_, idx) => idx !== i))}
              className="opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Add a recipient…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addFreeText()}
        />
        {query && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark shadow-lg">
            {suggestions.map((c) => (
              <button
                key={c.id}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  onChange([...selected, { name: c.name, email: c.email }]);
                  setQuery("");
                }}
              >
                {c.name} <span className="opacity-50">· {c.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
