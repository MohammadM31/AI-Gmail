import { useEffect, useState } from "react";
import type { Contact } from "../types";
import * as api from "../services/apiClient";

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setContacts(await api.listContacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addContact(input: { name: string; email: string; organization?: string }) {
    const contact = await api.createContact(input);
    setContacts((prev) => [contact, ...prev]);
  }

  async function removeContact(id: string) {
    await api.deleteContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return { contacts, loading, error, addContact, removeContact, reload: load };
}
