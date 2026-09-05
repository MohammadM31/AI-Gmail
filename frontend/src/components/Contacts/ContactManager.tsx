// frontend/src/components/Contacts/ContactManager.tsx
import { useState, FormEvent, useMemo } from "react";
import { useContacts } from "../../hooks/useContacts";
import { ContactDetail } from "./ContactDetail";

export function ContactManager() {
  const { contacts, loading, error, addContact, removeContact } = useContacts();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    
    // ✅ Email validation
    if (!email.includes('@') || !email.includes('.')) {
      alert("Please enter a valid email address");
      return;
    }
    
    await addContact({ name, email });
    setName("");
    setEmail("");
  }

  function handleEmailSelect(threadId: string) {
    console.log("Opening thread:", threadId);
  }

  // ✅ Filter contacts by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  if (selectedContactId) {
    return (
      <ContactDetail
        contactId={selectedContactId}
        onBack={() => setSelectedContactId(null)}
        onEmailSelect={handleEmailSelect}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ Search input */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
        />
        <button className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
          Add
        </button>
      </form>

      {loading && <p className="text-sm opacity-60">Loading…</p>}
      {error && <p className="text-sm text-highlight">{error}</p>}
      {!loading && !error && filteredContacts.length === 0 && (
        <p className="text-sm opacity-60">
          {searchQuery ? "No contacts match your search." : "No contacts yet. Add one above!"}
        </p>
      )}

      <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden">
        {filteredContacts.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <div
              className="flex-1"
              onClick={() => setSelectedContactId(c.id)}
            >
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs opacity-60">{c.email}</p>
              <p className="text-xs opacity-40 mt-0.5">
                Usage: {c.usageCount} times
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedContactId(c.id);
                }}
                className="text-xs underline opacity-60 hover:opacity-100"
              >
                View
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remove ${c.name}?`)) {
                    removeContact(c.id);
                  }
                }}
                className="text-xs opacity-50 hover:opacity-100 hover:text-highlight"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}