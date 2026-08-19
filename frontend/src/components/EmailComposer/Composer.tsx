import { useRef, useState, useEffect } from "react";
import { VoiceInput } from "./VoiceInput";
import { SplitView } from "./SplitView";
import { RecipientSuggester } from "./RecipientSuggester";
import { TemplateSelector } from "./TemplateSelector";
import { RunningSummary } from "./RunningSummary";
import { processMessage, createEmail, sendEmail, uploadAttachment } from "../../services/apiClient";
import type { AiProcessResult, Attachment } from "../../types";

interface ComposerProps {
  threadId?: string | null;
  onEmailSent?: () => void;
}

export function Composer({ threadId = null, onEmailSent }: ComposerProps) {
  const [text, setText] = useState("");
  const [recipients, setRecipients] = useState<{ name: string; email: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiProcessResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    setResult(null);
    try {
      const res = await processMessage(text);
      setResult(res);
      if (recipients.length === 0) setRecipients(res.recipients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadAttachment(f)));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attachment upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(path: string) {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }

  async function handleSaveDraft() {
    if (!result) return;
    try {
      const email = await createEmail({
        recipients,
        subject: result.subject,
        content: text,
        bulletPoints: result.bulletPoints,
        chartData: result.chart,
        attachments,
        threadId,
      });
      setSaved(true);
      setResult({ ...result, emailId: email.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    }
  }

  async function handleSend() {
    if (!result) return;
    setSending(true);
    setError(null);
    try {
      // First save as draft if not saved
      let emailId = (result as any).emailId;
      if (!emailId) {
        const email = await createEmail({
          recipients,
          subject: result.subject,
          content: text,
          bulletPoints: result.bulletPoints,
          chartData: result.chart,
          attachments,
          threadId,
        });
        emailId = email.id;
      }
      
      // Then send it
      await sendEmail(emailId);
      
      // Clear the form
      setText("");
      setRecipients([]);
      setResult(null);
      setAttachments([]);
      setSaved(false);
      
      // Notify parent
      if (onEmailSent) onEmailSent();
      
      alert("✅ Email sent successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Running Summary */}
      <RunningSummary threadId={threadId} />

      <TemplateSelector onSelect={(prompt) => setText(prompt)} />

      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-surface-light dark:bg-surface-dark space-y-3">
        <RecipientSuggester selected={recipients} onChange={setRecipients} />

        <textarea
          className="w-full min-h-28 resize-y bg-transparent outline-none placeholder:opacity-50"
          placeholder="Type your message, or use voice input…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li
                key={a.path}
                className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs"
              >
                <span className="max-w-[10rem] truncate">{a.name}</span>
                <button
                  onClick={() => removeAttachment(a.path)}
                  className="opacity-50 hover:opacity-100"
                  aria-label={`Remove ${a.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VoiceInput onTranscript={(t) => setText((prev) => (prev ? prev + " " + t : t))} />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "Attach files"}
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
            className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-highlight/10 text-highlight text-sm px-4 py-2">
          {error}{" "}
          <button className="underline" onClick={handleGenerate}>
            Retry
          </button>
        </div>
      )}

      {result && (
        <>
          <SplitView result={result} />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              className="rounded-full border border-black/10 dark:border-white/10 px-4 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Save Draft
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-full bg-green-500 px-6 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {sending ? "Sending…" : "📤 Send"}
            </button>
            {saved && <span className="text-xs opacity-60">Draft saved ✓</span>}
          </div>
        </>
      )}
    </div>
  );
}