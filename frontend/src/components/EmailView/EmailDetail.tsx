import { useEffect, useState } from "react";
import type { EmailItem, ProjectSummary } from "../../types";
import { ChartRenderer } from "../Shared/ChartRenderer";
import {
  createTask,
  deleteEmail,
  getAttachmentUrl,
  listProjectsSummary,
  replyEmail,
  restoreEmail,
  sendEmail,
  updateEmailFlags,
} from "../../services/apiClient";

const ACTIONABLE = /\b(send|review|prepare|decide|schedule|call|update|confirm|share)\b/i;

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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [trackFor, setTrackFor] = useState<string | null>(null);
  const [taskProject, setTaskProject] = useState("");
  const [taskStage, setTaskStage] = useState("");
  useEffect(() => {
    if (!email.bulletPoints.some((bullet) => ACTIONABLE.test(bullet))) return;
    listProjectsSummary().then(setProjects).catch(() => setProjects([]));
  }, [email.id]);
  const [note, setNote] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [label, setLabel] = useState("");

  async function handleOpenAttachment(path: string) {
    try {
      const { url } = await getAttachmentUrl(path);
      if (url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Failed to open attachment: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      const updated = await sendEmail(email.id);
      onUpdated(updated);
    } catch (err) {
      alert("Failed to send: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSending(false);
    }
  }

  async function act(folder: "inbox" | "spam" | "archive" | "trash") {
    if (folder === "trash") {
      await deleteEmail(email.id);
      onBack();
      return;
    }
    onUpdated(await updateEmailFlags(email.id, { folder }));
  }

  async function sendReply(mode: "reply" | "replyAll" | "forward") {
    if (!note.trim()) return;
    setSending(true);
    try {
      const recipients =
        mode === "forward"
          ? forwardTo
              .split(",")
              .map((part) => part.trim())
              .filter((part) => part.includes("@"))
              .map((emailAddress) => ({ name: emailAddress.split("@")[0], email: emailAddress }))
          : undefined;
      const updated = await replyEmail(email.id, { mode, message: note, recipients });
      setNote("");
      onUpdated(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not send");
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
        <div className="flex items-center justify-between mb-2 gap-2">
          <h2 className="font-semibold">{email.subject}</h2>
          <span className="text-xs opacity-50 capitalize">{email.deliveryStatus || email.status}</span>
        </div>
        {email.from && (
          <p className="text-xs opacity-60 mb-1">
            From: {email.from.name} {email.from.email ? `<${email.from.email}>` : ""}
          </p>
        )}
        <p className="text-xs opacity-60 mb-1">
          To: {email.recipients.map((r) => r.name).join(", ") || "—"}
        </p>
        {email.cc && email.cc.length > 0 && (
          <p className="text-xs opacity-60 mb-1">Cc: {email.cc.map((r) => r.name).join(", ")}</p>
        )}
        {email.bcc && email.bcc.length > 0 && (
          <p className="text-xs opacity-60 mb-1">Bcc: {email.bcc.map((r) => r.name).join(", ")}</p>
        )}
        {email.bounceReason && <p className="text-xs text-highlight mb-2">{email.bounceReason}</p>}
        {email.labels && email.labels.length > 0 && (
          <p className="text-xs opacity-60 mb-2">{email.labels.join(" · ")}</p>
        )}
        <ul className="space-y-1 text-sm mb-3">
          {email.bulletPoints.map((b, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="opacity-50">•</span>
              <span>{b}</span>
              {ACTIONABLE.test(b) && (
                <button
                  type="button"
                  onClick={() => setTrackFor(trackFor === b ? null : b)}
                  className="rounded-full border border-black/10 dark:border-white/10 px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
                >
                  Track
                </button>
              )}
            </li>
          ))}
        </ul>
        {trackFor && (
          <form
            className="mb-3 flex flex-wrap items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await createTask({
                  title: trackFor,
                  projectId: taskProject || undefined,
                  pipelineStageId: taskStage.trim() || undefined,
                  emailId: email.id,
                });
                setNote("Task saved.");
                setTrackFor(null);
              } catch (err) {
                setNote(err instanceof Error ? err.message : "Could not save the task");
              }
            }}
          >
            <select
              aria-label="Project"
              value={taskProject}
              onChange={(event) => setTaskProject(event.target.value)}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs"
            >
              <option value="">Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <input
              aria-label="Pipeline stage id"
              value={taskStage}
              onChange={(event) => setTaskStage(event.target.value)}
              placeholder="Pipeline stage id"
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded-full bg-highlight px-3 py-1 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              Save task
            </button>
          </form>
        )}
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
        <div className="flex flex-wrap gap-2 mb-3">
          {email.status === "draft" && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          )}
          <button onClick={() => act("archive")} className="rounded-full border px-3 py-1 text-xs">Archive</button>
          <button onClick={() => act("spam")} className="rounded-full border px-3 py-1 text-xs">Spam</button>
          <button onClick={() => act("trash")} className="rounded-full border px-3 py-1 text-xs">Trash</button>
          {email.folder === "trash" && (
            <button
              onClick={() => restoreEmail(email.id).then(onUpdated)}
              className="rounded-full border px-3 py-1 text-xs"
            >
              Restore
            </button>
          )}
        </div>
        <div className="space-y-2 border-t border-black/10 dark:border-white/10 pt-3">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Reply in a sentence. It stays a few facts."
            className="w-full min-h-16 bg-transparent text-sm outline-none"
          />
          <input
            value={forwardTo}
            onChange={(event) => setForwardTo(event.target.value)}
            placeholder="Forward to email, comma separated"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button disabled={sending} onClick={() => sendReply("reply")} className="rounded-full bg-highlight px-3 py-1 text-xs text-white">Reply</button>
            <button disabled={sending} onClick={() => sendReply("replyAll")} className="rounded-full border px-3 py-1 text-xs">Reply all</button>
            <button disabled={sending} onClick={() => sendReply("forward")} className="rounded-full border px-3 py-1 text-xs">Forward</button>
          </div>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Add a label"
              className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
            />
            <button
              className="text-xs underline"
              onClick={() => {
                if (!label.trim()) return;
                updateEmailFlags(email.id, { labels: [...(email.labels ?? []), label.trim()] }).then((updated) => {
                  setLabel("");
                  onUpdated(updated);
                });
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {email.chartData && <ChartRenderer chart={email.chartData} />}
    </div>
  );
}
