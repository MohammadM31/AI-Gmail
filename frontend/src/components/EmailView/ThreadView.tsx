import { useCallback, useEffect, useState } from "react";
import { EmailItem } from "../../types";
import { getThread } from "../../services/apiClient";
import { useUserStore } from "../../stores/userStore";
import { ThreadMessage } from "./ThreadMessage";
import { RunningSummary } from "../EmailComposer/RunningSummary";
import { Composer } from "../EmailComposer/Composer";

interface ThreadViewProps {
  threadId: string;
  onBack: () => void;
}

export function ThreadView({ threadId, onBack }: ThreadViewProps) {
  const [messages, setMessages] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryVersion, setSummaryVersion] = useState(0);
  const currentUser = useUserStore((s) => s.user);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const threadMessages = await getThread(threadId);
      setMessages(threadMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread");
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  async function handleReplySent() {
    await loadThread();
    setSummaryVersion((v) => v + 1);
  }

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Get sender name from email or current user
  const getSenderName = (email: EmailItem) => {
    if (email.senderId === currentUser?.id) return "You";
    const firstRecipient = email.recipients[0];
    return firstRecipient?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
          ← Back to inbox
        </button>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
          ← Back to inbox
        </button>
        <div className="rounded-xl bg-red-500/10 p-4 text-red-500 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
        ← Back to inbox
      </button>

      <RunningSummary key={`${threadId}-${summaryVersion}`} threadId={threadId} />

      <div className="space-y-4">
        {messages.map((message) => (
          <ThreadMessage
            key={message.id}
            message={message}
            isCurrentUser={Boolean(currentUser) && message.senderId === currentUser.id}
            senderName={getSenderName(message)}
          />
        ))}
      </div>

      <div className="border-t border-black/10 dark:border-white/10 pt-4">
        <h4 className="text-sm font-medium mb-3">Reply to thread</h4>
        <Composer threadId={threadId} onEmailSent={handleReplySent} />
      </div>
    </div>
  );
}