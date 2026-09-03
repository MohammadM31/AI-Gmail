// frontend/src/components/Contacts/ContactDetail.tsx
import { useEffect, useState } from "react";
import { getContact, getContactSummary, getContactThreads } from "../../services/apiClient";
import { PipelineView } from "../Pipeline/PipelineView";
import type { Contact } from "../../types";

interface ContactDetailProps {
  contactId: string;
  onBack: () => void;
  onEmailSelect: (threadId: string) => void;
}

export function ContactDetail({ contactId, onBack, onEmailSelect }: ContactDetailProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "history" | "pipeline">("summary");

  useEffect(() => {
    loadContact();
  }, [contactId]);

  async function loadContact() {
    setLoading(true);
    setError(null);
    try {
      const contactData = await getContact(contactId);
      setContact(contactData);

      // Try to load summary and threads, but don't fail if they 404
      try {
        const summaryData = await getContactSummary(contactId);
        setSummary(summaryData.summary);
        setEmails(summaryData.emails || []);
      } catch (summaryErr) {
        console.warn('Summary not available:', summaryErr);
        setSummary(['No summary available for this contact.']);
        setEmails([]);
      }

      try {
        const threadsData = await getContactThreads(contactId);
        setThreads(threadsData.threads || []);
      } catch (threadsErr) {
        console.warn('Threads not available:', threadsErr);
        setThreads([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contact details");
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(date: string) {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400";
    }
  }

  // Get the first thread ID for Pipeline
  const firstThreadId = threads.length > 0 ? threads[0]?.threadId : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
          ← Back to contacts
        </button>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
          ← Back to contacts
        </button>
        <div className="rounded-xl bg-red-500/10 p-4 text-red-500 text-sm">
          {error || "Contact not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
        ← Back to contacts
      </button>

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent-light/20 dark:bg-accent-dark/40 flex items-center justify-center text-2xl font-semibold">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{contact.name}</h2>
            <p className="text-sm opacity-60">{contact.email}</p>
            {contact.organization && (
              <p className="text-xs opacity-40">{contact.organization}</p>
            )}
            <p className="text-xs opacity-40 mt-1">Usage: {contact.usageCount} times</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-black/10 dark:border-white/10">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "summary"
              ? "border-b-2 border-highlight text-highlight"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          📋 Thread Summary
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "history"
              ? "border-b-2 border-highlight text-highlight"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          💬 Conversation History ({emails.length})
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === "pipeline"
              ? "border-b-2 border-highlight text-highlight"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          📊 Pipeline
        </button>
      </div>

      {activeTab === "summary" && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <span>📋</span> Thread Summary with {contact.name}
          </h3>
          {summary.length === 0 || (summary.length === 1 && summary[0] === "No conversation history with this contact yet.") ? (
            <p className="text-sm opacity-60">{summary[0] || "No conversation history yet."}</p>
          ) : (
            <ul className="space-y-2">
              {summary.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="opacity-50">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-xs opacity-40">
            Based on {emails.length} email{emails.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {emails.length === 0 ? (
            <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 text-center text-sm opacity-60">
              No emails exchanged with {contact.name} yet.
            </div>
          ) : (
            emails.map((email) => (
              <button
                key={email.id}
                onClick={() => {
                  const threadId = email.threadId || email.id;
                  onEmailSelect(threadId);
                }}
                className="w-full text-left rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{email.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(email.status)}`}>
                      {email.status}
                    </span>
                    <span className="text-xs opacity-40">{formatTimestamp(email.createdAt)}</span>
                  </div>
                </div>
                <p className="text-xs opacity-60 mt-1 line-clamp-2">{email.content}</p>
                {email.bulletPoints && email.bulletPoints.length > 0 && (
                  <div className="mt-1 text-xs opacity-40">
                    {email.bulletPoints[0]}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {activeTab === "pipeline" && (
        <PipelineView
          contactId={contactId}
          contactName={contact.name}
          threadId={firstThreadId}
          onClose={() => {}}
        />
      )}
    </div>
  );
}