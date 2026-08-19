import { useEffect, useState } from "react";
import { EmailItem } from "../../types";
import { getThread, getThreadSummary } from "../../services/apiClient";
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
  const [summary, setSummary] = useState<string[]>([]);

  useEffect(() => {
    async function loadThread() {
      setLoading(true);
      setError(null);
      try {
        const [threadMessages, summaryData] = await Promise.all([
          getThread(threadId),
          getThreadSummary(threadId).catch(() => ({ summary: [] })),
        ]);
        setMessages(threadMessages);
        setSummary(summaryData.summary || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load thread");
      } finally {
        setLoading(false);
      }
    }
    loadThread();
  }, [threadId]);

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

      {/* Running Summary */}
      <RunningSummary threadId={threadId} />

      {/* Thread Messages */}
      <div className="space-y-4">
        {messages.map((message) => (
          <ThreadMessage
            key={message.id}
            message={message}
            isCurrentUser={message.senderId === "current-user-id"} // Replace with actual user ID
          />
        ))}
      </div>

      {/* Reply Composer */}
      <div className="border-t border-black/10 dark:border-white/10 pt-4">
        <h4 className="text-sm font-medium mb-3">Reply to thread</h4>
        <Composer threadId={threadId} onEmailSent={() => {}} />
      </div>
    </div>
  );
}