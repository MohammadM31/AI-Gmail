// frontend/src/components/EmailComposer/Composer.tsx
import { useRef, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { VoiceInput } from "./VoiceInput";
import { SplitView } from "./SplitView";
import { RecipientSuggester } from "./RecipientSuggester";
import { TemplateSelector } from "./TemplateSelector";
import { RunningSummary } from "./RunningSummary";
import { processMessage, createEmail, sendEmail, uploadAttachment } from "../../services/apiClient";
import type { AiProcessResult, Attachment } from "../../types";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

interface ComposerProps {
  threadId?: string | null;
  onEmailSent?: () => void;
  externalState?: {
    text: string;
    recipients: { name: string; email: string | null }[];
    attachments: Attachment[];
    result: AiProcessResult | null;
    saved: boolean;
  };
  onStateChange?: (state: any) => void;
}

export function Composer({ 
  threadId = null, 
  onEmailSent,
  externalState,
  onStateChange 
}: ComposerProps) {
  // ✅ State
  const [text, setText] = useState(externalState?.text || "");
  const [recipients, setRecipients] = useState(externalState?.recipients || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiProcessResult | null>(externalState?.result || null);
  const [saved, setSaved] = useState(externalState?.saved || false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(externalState?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasValidRecipients = recipients.length > 0;

  // ✅ Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "Enter",
      meta: true,
      action: handleSend,
      preventDefault: true,
    },
    {
      key: "s",
      meta: true,
      action: handleSaveDraft,
      preventDefault: true,
    },
    {
      key: "Escape",
      action: () => {
        if (isDirty && confirm("You have unsaved changes. Discard?")) {
          resetComposer();
        }
      },
    },
  ]);

  // ✅ Auto-save draft every 30 seconds
  useEffect(() => {
    if (!text.trim() || !result || saved || !isDirty) return;

    const timer = setTimeout(() => {
      handleSaveDraft();
    }, 30000);

    return () => clearTimeout(timer);
  }, [text, result, saved, isDirty]);

  // ✅ Sync external state
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ text, recipients, attachments, result, saved });
    }
  }, [text, recipients, attachments, result, saved]);

  // ✅ Mark as dirty when content changes
  useEffect(() => {
    if (text.trim() || recipients.length > 0 || attachments.length > 0) {
      setIsDirty(true);
    }
  }, [text, recipients, attachments]);

  function resetComposer() {
    setText("");
    setRecipients([]);
    setResult(null);
    setAttachments([]);
    setSaved(false);
    setIsDirty(false);
    setError(null);
  }

  async function handleGenerate() {
    if (!text.trim()) {
      toast.warning("Please enter a message first");
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);
    setResult(null);
    try {
      const res = await processMessage(text);
      setResult(res);
      if (res.recipients && res.recipients.length > 0) {
        setRecipients(res.recipients);
        toast.success(`Found ${res.recipients.length} recipient(s)`);
      } else if (res._warning) {
        setError(res._warning);
        toast.warning(res._warning);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      setError(errorMessage);
      toast.error("Failed to process message", { description: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    
    // ✅ Validate file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversized = Array.from(files).filter(f => f.size > maxSize);
    if (oversized.length > 0) {
      toast.error("File too large", { 
        description: `${oversized.map(f => f.name).join(", ")} exceed 10MB limit` 
      });
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadAttachment(f)));
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(`Uploaded ${uploaded.length} file(s)`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      toast.error("Attachment upload failed", { description: errorMessage });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(path: string) {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
    toast.info("Attachment removed");
  }

  async function handleSaveDraft() {
    if (!result) {
      toast.warning("Generate content first before saving");
      return;
    }

    if (!result.subject?.trim()) {
      toast.error("Subject is required");
      setError("Subject is required to save");
      return;
    }
    if (!text.trim()) {
      toast.error("Email content is required");
      setError("Email content is required");
      return;
    }
    if (!hasValidRecipients) {
      toast.error("Please add at least one valid recipient");
      setError("Please add at least one valid recipient before saving.");
      return;
    }

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
      setIsDirty(false);
      setResult({ ...result, emailId: email.id });
      toast.success("Draft saved successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save draft";
      setError(errorMessage);
      toast.error("Failed to save draft", { description: errorMessage });
    }
  }

  async function handleSend() {
    if (!result) {
      toast.warning("Generate content first before sending");
      return;
    }

    if (!result.subject?.trim()) {
      toast.error("Subject is required");
      setError("Subject is required");
      return;
    }
    if (!text.trim()) {
      toast.error("Email content is required");
      setError("Email content is required");
      return;
    }
    if (!hasValidRecipients) {
      toast.error("Please add at least one valid recipient");
      setError("Please add at least one valid recipient before sending.");
      return;
    }

    setSending(true);
    setError(null);
    try {
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

      await sendEmail(emailId);

      toast.success("✅ Email sent successfully!", {
        description: `To: ${recipients.map(r => r.name).join(", ")}`,
      });

      resetComposer();

      if (onEmailSent) onEmailSent();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send email";
      setError(errorMessage);
      toast.error("Failed to send email", { description: errorMessage });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Thread Summary */}
      <RunningSummary threadId={threadId} />

      {/* Template Selector */}
      <TemplateSelector onSelect={(prompt) => setText(prompt)} />

      {/* Main Editor */}
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-surface-light dark:bg-surface-dark space-y-3">
        {/* Recipients */}
        <RecipientSuggester selected={recipients} onChange={setRecipients} />

        {/* Subject line */}
        {result && (
          <div className="flex items-center gap-2 pb-2 border-b border-black/10 dark:border-white/10">
            <span className="text-xs opacity-40 font-medium">Subject:</span>
            <span className="text-sm font-medium">{result.subject}</span>
            <span className="text-xs opacity-40 ml-auto">
              Tone: <span className="capitalize">{result.tone}</span>
            </span>
          </div>
        )}

        {/* Message body */}
        <textarea
          className="w-full min-h-28 resize-y bg-transparent outline-none placeholder:opacity-50 text-sm"
          placeholder="Type your message, or use voice input… (⌘+Enter to send)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* Attachments */}
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <li
                key={a.path}
                className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs"
              >
                <span className="max-w-[10rem] truncate">📎 {a.name}</span>
                {a.size && (
                  <span className="opacity-40">
                    {(a.size / 1024).toFixed(1)}KB
                  </span>
                )}
                <button
                  onClick={() => removeAttachment(a.path)}
                  className="opacity-50 hover:opacity-100 hover:text-red-500 transition"
                  aria-label={`Remove ${a.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VoiceInput onTranscript={(t) => setText((prev) => (prev ? prev + " " + t : t))} />
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.png,.jpg,.jpeg,.gif,.webp"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
            >
              {uploading ? "Uploading…" : "📎 Attach files"}
            </button>

            {/* Dirty indicator */}
            {isDirty && !saved && (
              <span className="text-xs opacity-40">• unsaved</span>
            )}
            {saved && (
              <span className="text-xs text-green-500">✓ saved</span>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
            className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition"
          >
            {loading ? "Generating…" : "✨ Generate"}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-highlight/10 text-highlight text-sm px-4 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button className="underline text-xs opacity-70 hover:opacity-100" onClick={handleGenerate}>
            Retry
          </button>
        </div>
      )}

      {/* AI Result and Actions */}
      {result && (
        <>
          <SplitView result={result} />
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={!hasValidRecipients || sending}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                !hasValidRecipients || sending
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              💾 Save Draft
            </button>
            
            <button
              onClick={handleSend}
              disabled={sending || !hasValidRecipients}
              className={`rounded-full px-6 py-1.5 text-sm font-medium text-white transition ${
                !hasValidRecipients || sending
                  ? "opacity-40 cursor-not-allowed bg-gray-400"
                  : "bg-green-500 hover:opacity-90"
              }`}
            >
              {sending ? "Sending…" : "📤 Send"}
            </button>

            {!hasValidRecipients && (
              <span className="text-xs text-highlight">⚠️ Add a valid recipient</span>
            )}

            {saved && (
              <span className="text-xs opacity-60">✓ Draft saved</span>
            )}

            <span className="text-xs opacity-40 ml-auto">
              {recipients.length} recipient{recipients.length !== 1 ? "s" : ""} · 
              {text.length} characters · 
              {attachments.length} attachment{attachments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-xs opacity-30 text-center">
        ⌘+Enter to send · ⌘+S to save draft · Esc to discard
      </div>
    </div>
  );
}