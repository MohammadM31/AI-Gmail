import { useEffect, useState } from "react";
import type { Contact } from "../../types";
import { getMailbox, listContacts } from "../../services/apiClient";

interface Props {
  selected: { name: string; email: string | null }[];
  onChange: (recipients: { name: string; email: string | null }[]) => void;
}

const COMPANY_DOMAIN = "@raidtechs.com";

function isCompanyEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  return value.length > COMPANY_DOMAIN.length && value.endsWith(COMPANY_DOMAIN) && value.indexOf("@") === value.length - COMPANY_DOMAIN.length;
}

export function RecipientSuggester({ selected, onChange }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<{ name: string; addresses: { name: string; email: string | null }[] }[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listContacts().then(setContacts).catch(() => {});
    getMailbox().then((mailbox) => setLists(mailbox.lists)).catch(() => {});
  }, []);

  const suggestions = contacts.filter(
    (c) =>
      isCompanyEmail(c.email) &&
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      !selected.some((s) => s.email === c.email)
  );

  function addFreeText() {
    const raw = query.trim();
    if (!raw) return;
    const named = raw.match(/^(.*)<([^>]+)>$/);
    const email = (named ? named[2] : raw).trim();
    if (!isCompanyEmail(email)) {
      setError(`${email} is not a ${COMPANY_DOMAIN} address. Mail stays inside the company.`);
      return;
    }
    const name = (named ? named[1] : email.split("@")[0]).trim() || email;
    onChange([...selected, { name, email }]);
    setError("");
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
              type="button"
              aria-label={`Remove ${r.name}`}
              onClick={() => onChange(selected.filter((_, idx) => idx !== i))}
              className="opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="teammate@raidtechs.com"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && addFreeText()}
        />
        {query && lists.some((list) => list.name.toLowerCase().includes(query.toLowerCase())) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark shadow-lg">
            {lists
              .filter((list) => list.name.toLowerCase().includes(query.toLowerCase()))
              .map((list) => (
                <button
                  key={list.name}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={() => {
                    const next = list.addresses.filter(
                      (address) =>
                        isCompanyEmail(address.email) && !selected.some((item) => item.email === address.email)
                    );
                    onChange([...selected, ...next]);
                    setQuery("");
                  }}
                >
                  List · {list.name}
                </button>
              ))}
          </div>
        )}
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
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
