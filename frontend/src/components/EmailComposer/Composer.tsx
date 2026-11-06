// frontend/src/components/EmailComposer/Composer.tsx
import { useRef, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { VoiceInput } from "./VoiceInput";
import { SplitView } from "./SplitView";
import { RecipientSuggester } from "./RecipientSuggester";
import { TemplateSelector } from "./TemplateSelector";
import { RunningSummary } from "./RunningSummary";
import { processMessage, createEmail, sendEmail, undoSend, uploadAttachment } from "../../services/apiClient";
import type { AiProcessResult, Attachment, ChartKind } from "../../types";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const FACT_SPAN = new RegExp(
  [
    // Numbers in any script, with currency, percent and a.m./p.m. suffixes: 70%, 7pm, 7:30, 2026-11-06.
    String.raw`\p{Sc}?\p{Nd}+(?:[.,:/-]\p{Nd}+)*(?:\s?(?:%|\u066A|percent\b|per cent\b|[ap]\.?m(?!\p{L})\.?))?`,
    // Spelled-out English months and weekdays. Other languages are caught by their digits.
    String.raw`\b(?:january|february|march|april|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b`,
  ].join("|"),
  "giu"
);

interface FactSegment {
  text: string;
  hit: boolean;
}

/** Splits one bullet around its numbers, percents, dates and times. Returns null when it has none. */
function factSegments(bullet: string): FactSegment[] | null {
  const re = new RegExp(FACT_SPAN.source, FACT_SPAN.flags);
  const out: FactSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(bullet)) !== null) {
    if (match.index > last) out.push({ text: bullet.slice(last, match.index), hit: false });
    out.push({ text: match[0], hit: true });
    last = match.index + match[0].length;
  }
  if (out.length === 0) return null;
  if (last < bullet.length) out.push({ text: bullet.slice(last), hit: false });
  return out;
}

function bulletsWithFacts(bullets: string[]) {
  return bullets.flatMap((bullet, index) => {
    const segments = factSegments(bullet);
    return segments ? [{ index, segments }] : [];
  });
}

interface ComposerProps {
  threadId?: string | null;
  onEmailSent?: () => void;
  externalState?: {
    text: string;
    recipients: { name: string; email: string | null }[];
    attachments: Attachment[];
    result: AiProcessResult | null;
    saved: boolean;
    language?: string;
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
  const [ccText, setCcText] = useState("");
  const [bccText, setBccText] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiProcessResult | null>(externalState?.result || null);
  const [saved, setSaved] = useState(externalState?.saved || false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(externalState?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState(externalState?.language || "en-US");
  const [graphicOn, setGraphicOn] = useState(true);
  const [chartType, setChartType] = useState<ChartKind | "auto">("auto");
  const [chartTitle, setChartTitle] = useState("");
  const [confirmingFacts, setConfirmingFacts] = useState(false);

  const hasValidRecipients =
    recipients.length > 0 && recipients.every((recipient) => recipient.email?.includes("@"));

  function extraAddresses(value: string) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const email = part.match(/[^\s<>,"]+@[^\s<>,"]+/)?.[0] ?? "";
        const name = part.replace(email, "").replace(/[<>]/g, "").trim() || email.split("@")[0];
        return { name, email };
      })
      .filter((recipient) => recipient.email.includes("@"));
  }

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
      onStateChange({ text, recipients, attachments, result, saved, language });
    }
  }, [text, recipients, attachments, result, saved, language]);

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
    setConfirmingFacts(false);
    try {
      const chartChoice = {
        ...(graphicOn ? {} : { enabled: false }),
        ...(chartType === "auto" ? {} : { type: chartType }),
        ...(chartTitle.trim() ? { title: chartTitle.trim() } : {}),
      };
      const res = await processMessage(text, {
        language,
        ...(Object.keys(chartChoice).length > 0 ? { chart: chartChoice } : {}),
      });
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
        cc: extraAddresses(ccText),
        bcc: extraAddresses(bccText),
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

    if (bulletsWithFacts(result.bulletPoints).length > 0) {
      setConfirmingFacts(true);
      return;
    }

    await deliver();
  }

  async function deliver() {
    if (!result) return;
    setConfirmingFacts(false);
    setSending(true);
    setError(null);
    try {
      let emailId = (result as any).emailId;
      if (!emailId) {
        const email = await createEmail({
          recipients,
          cc: extraAddresses(ccText),
          bcc: extraAddresses(bccText),
          subject: result.subject,
          content: text,
          bulletPoints: result.bulletPoints,
          chartData: result.chart,
          attachments,
          threadId,
        });
        emailId = email.id;
      }

      const sent = await sendEmail(emailId, sendAt ? { sendAt: new Date(sendAt).toISOString() } : undefined);

      if (sent.status === "pending") {
        toast.success("Sending in a few seconds", {
          description: `To: ${recipients.map((r) => r.name).join(", ")}`,
          action: { label: "Undo", onClick: () => undoSend(sent.id) },
        });
      } else {
        toast.success("Scheduled", { description: sent.sentAt ? new Date(sent.sentAt).toLocaleString() : "" });
      }

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

  function handleResultEdit(patch: Partial<Pick<AiProcessResult, "bulletPoints" | "chart">>) {
    // A saved draft holds the old bullets and graphic, so Send makes a fresh draft.
    setResult((prev) => (prev ? { ...prev, ...patch, emailId: undefined } : prev));
    setSaved(false);
    setIsDirty(true);
  }

  const factBullets = result ? bulletsWithFacts(result.bulletPoints) : [];

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
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Cc, comma separated"
          value={ccText}
          onChange={(event) => setCcText(event.target.value)}
        />
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Bcc, comma separated"
          value={bccText}
          onChange={(event) => setBccText(event.target.value)}
        />
        <label className="flex items-center gap-2 text-xs opacity-70">
          Schedule
          <input
            type="datetime-local"
            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
            value={sendAt}
            onChange={(event) => setSendAt(event.target.value)}
          />
        </label>

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
          dir="auto"
          className="w-full min-h-28 resize-y bg-transparent outline-none placeholder:opacity-50 text-sm focus-visible:ring-2 focus-visible:ring-highlight"
          aria-label="Message"
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

        {/* Graphic choice */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={graphicOn}
              onChange={(e) => setGraphicOn(e.target.checked)}
            />
            Graphic
          </label>
          <select
            aria-label="Chart type"
            className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
            value={chartType}
            disabled={!graphicOn}
            onChange={(e) => setChartType(e.target.value as ChartKind | "auto")}
          >
            <option value="auto">Auto</option>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <input
            dir="auto"
            aria-label="Chart title"
            className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 outline-none"
            placeholder="Chart title (optional)"
            maxLength={100}
            value={chartTitle}
            disabled={!graphicOn}
            onChange={(e) => setChartTitle(e.target.value)}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VoiceInput
              initialLanguage={language}
              onLanguageChange={setLanguage}
              onTranscript={(t) => setText((prev) => (prev ? prev + " " + t : t))}
            />
            
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
          <SplitView result={result} onChange={handleResultEdit} />
          
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

          {confirmingFacts && factBullets.length > 0 && (
            <div
              role="alertdialog"
              aria-label="Confirm numbers, dates and times"
              className="rounded-xl border border-highlight/40 bg-highlight/5 p-4 space-y-3 text-sm"
            >
              <p className="font-medium">Check these before sending</p>
              <ul className="space-y-1">
                {factBullets.map(({ index, segments }) => (
                  <li key={index} dir="auto">
                    {segments.map((segment, i) =>
                      segment.hit ? (
                        <mark key={i} className="rounded bg-highlight/20 px-1 font-medium">
                          {segment.text}
                        </mark>
                      ) : (
                        <span key={i}>{segment.text}</span>
                      )
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={deliver}
                  disabled={sending}
                  className="rounded-full bg-green-500 px-4 py-1.5 font-medium text-white disabled:opacity-40 hover:opacity-90 transition"
                >
                  {sending ? "Sending…" : "These are correct, send"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingFacts(false)}
                  className="rounded-full border border-black/10 dark:border-white/10 px-4 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  Go back and edit
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-xs opacity-30 text-center">
        ⌘+Enter to send · ⌘+S to save draft · Esc to discard
      </div>
    </div>
  );
}