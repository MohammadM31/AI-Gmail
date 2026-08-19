import { useState, FormEvent } from "react";
import { useContacts } from "../../hooks/useContacts";

export function ContactManager() {
  const { contacts, loading, error, addContact, removeContact } = useContacts();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    await addContact({ name, email });
    setName("");
    setEmail("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
          Add
        </button>
      </form>

      {loading && <p className="text-sm opacity-60">Loading…</p>}
      {error && <p className="text-sm text-highlight">{error}</p>}

      <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs opacity-60">{c.email}</p>
            </div>
            <button
              onClick={() => removeContact(c.id)}
              className="text-xs opacity-50 hover:opacity-100 hover:text-highlight"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
