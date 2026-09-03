// frontend/src/components/Templates/TemplateManager.tsx
import { useEffect, useState, FormEvent } from "react";
import type { Template, Contact } from "../../types";
import { listTemplates, createTemplate, deleteTemplate, listContacts, sendTemplateNow } from "../../services/apiClient";

export function TemplateManager({ onUse }: { onUse: (prompt: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTemplates();
    loadContacts();
  }, []);

  async function loadTemplates() {
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }

  async function loadContacts() {
    try {
      const data = await listContacts();
      setContacts(data);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    
    // ✅ Validate schedule date
    if (scheduleDate) {
      const selectedDate = new Date(scheduleDate);
      if (selectedDate < new Date()) {
        alert("Schedule date must be in the future");
        return;
      }
    }
    
    setLoading(true);
    try {
      const template = await createTemplate({
        name,
        prompt,
        description: description || undefined,
        recipientId: recipientId || undefined,
        scheduleDate: scheduleDate || undefined,
        autoSend: !!scheduleDate && autoSend,
      });
      setTemplates((prev) => [template, ...prev]);
      setName("");
      setPrompt("");
      setDescription("");
      setRecipientId("");
      setScheduleDate("");
      setAutoSend(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendNow(id: string) {
    setSending((prev) => ({ ...prev, [id]: true }));
    try {
      await sendTemplateNow(id);
      alert("✅ Email sent successfully!");
      await loadTemplates();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send template");
    } finally {
      setSending((prev) => ({ ...prev, [id]: false }));
    }
  }

  const formatScheduleDate = (date: string | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getRecipientName = (template: Template) => {
    if (!template.recipientId) return "No recipient set";
    const contact = contacts.find((c) => c.id === template.recipientId);
    return contact?.name || "Unknown contact";
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-black/10 dark:border-white/10 p-4 bg-surface-light dark:bg-surface-dark">
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none resize-y min-h-[60px]"
          placeholder="Prompt this template fills in… (Use {contact} for recipient name)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
          >
            <option value="">No recipient set</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)} // ✅ Prevent past dates
          />
        </div>

        {scheduleDate && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSend"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              className="rounded border border-black/10 dark:border-white/10"
            />
            <label htmlFor="autoSend" className="text-sm opacity-70">
              Auto-send on schedule
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Saving…" : "Save template"}
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{t.name}</p>
                {t.description && (
                  <p className="text-xs opacity-60">{t.description}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {t.isScheduled && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    📅 Scheduled
                  </span>
                )}
                {t.autoSend && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    🔄 Auto
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs opacity-60 mt-1 line-clamp-2">{t.prompt}</p>

            <div className="flex items-center justify-between text-xs">
              <span className="opacity-60">
                {t.recipientId ? `To: ${getRecipientName(t)}` : "No recipient"}
              </span>
              <span className="opacity-40">
                Used {t.usageCount} times
              </span>
            </div>

            {t.scheduleDate && (
              <p className="text-xs opacity-40">
                Scheduled: {formatScheduleDate(t.scheduleDate)}
                {t.lastSentAt && ` • Last sent: ${formatScheduleDate(t.lastSentAt)}`}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => onUse(t.prompt)}
                className="text-xs underline opacity-70 hover:opacity-100"
              >
                Use
              </button>
              {t.recipientId && (
                <button
                  onClick={() => handleSendNow(t.id)}
                  disabled={sending[t.id]}
                  className="text-xs underline opacity-70 hover:opacity-100 disabled:opacity-30"
                >
                  {sending[t.id] ? "Sending…" : "Send now"}
                </button>
              )}
              <button
                onClick={async () => {
                  if (confirm(`Delete template "${t.name}"?`)) {
                    await deleteTemplate(t.id);
                    setTemplates((prev) => prev.filter((item) => item.id !== t.id));
                  }
                }}
                className="text-xs underline opacity-50 hover:opacity-100 hover:text-highlight"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}