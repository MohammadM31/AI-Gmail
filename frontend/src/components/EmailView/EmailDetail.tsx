import type { EmailItem } from "../../types";
import { ChartRenderer } from "../Shared/ChartRenderer";
import { sendEmail, getAttachmentUrl } from "../../services/apiClient";
import { useState } from "react";

export function EmailDetail({
  email,
  onBack,
  onUpdated,
}: {
  email: EmailItem;
  onBack: () => void;
  onUpdated: (email: EmailItem) => void;
}) {
  const [sending, setSending] = useState(false);

  async function handleOpenAttachment(path: string) {
    const { url } = await getAttachmentUrl(path);
    if (url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleSend() {
    setSending(true);
    try {
      const updated = await sendEmail(email.id);
      onUpdated(updated);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs opacity-60 hover:opacity-100 underline">
        ← Back to inbox
      </button>

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">{email.subject}</h2>
          <span className="text-xs opacity-50 capitalize">{email.status}</span>
        </div>
        <p className="text-xs opacity-60 mb-3">
          To: {email.recipients.map((r) => r.name).join(", ") || "—"}
        </p>
        <ul className="space-y-1 text-sm mb-3">
          {email.bulletPoints.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="opacity-50">•</span>
              {b}
            </li>
          ))}
        </ul>
        {email.attachments?.length > 0 && (
          <ul className="flex flex-wrap gap-2 mb-3">
            {email.attachments.map((a) => (
              <li key={a.path}>
                <button
                  onClick={() => handleOpenAttachment(a.path)}
                  className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  📎 {a.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {email.status === "draft" && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        )}
      </div>

      {email.chartData && <ChartRenderer chart={email.chartData} />}
    </div>
  );
}
