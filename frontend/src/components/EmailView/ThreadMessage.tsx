import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmailItem, ProjectSummary } from "../../types";
import { ChartRenderer } from "../Shared/ChartRenderer";
import { createTask, listProjectsSummary } from "../../services/apiClient";

const ACTIONABLE = /\b(send|review|prepare|decide|schedule|call|update|confirm|share)\b/i;

interface ThreadMessageProps {
  message: EmailItem;
  isCurrentUser: boolean;
  senderName: string;
}

export function ThreadMessage({ message, isCurrentUser, senderName }: ThreadMessageProps) {
  const [trackFor, setTrackFor] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [taskProject, setTaskProject] = useState("");
  const [taskStage, setTaskStage] = useState("");

  useEffect(() => {
    if (!message.bulletPoints.some((bullet) => ACTIONABLE.test(bullet))) return;
    listProjectsSummary().then(setProjects).catch(() => setProjects([]));
  }, [message.id]);
  const getFullTimestamp = (date: string) => {
    return new Date(date).toLocaleString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimestamp = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }
  };

  return (
    <div className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isCurrentUser
            ? "bg-highlight text-white"
            : "bg-surface-light dark:bg-surface-dark border border-black/10 dark:border-white/10"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">
            {senderName}
          </span>
          <span className="text-xs opacity-60" title={getFullTimestamp(message.createdAt)}>
            {formatTimestamp(message.createdAt)}
          </span>
        </div>
        <p className="text-sm">{message.content}</p>
        {message.bulletPoints.length > 0 && (
          <ul className="mt-2 text-sm space-y-1">
            {message.bulletPoints.map((point, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="opacity-50">•</span>
                <span>{point}</span>
                {ACTIONABLE.test(point) && (
                  <button
                    type="button"
                    onClick={() => setTrackFor(trackFor === point ? null : point)}
                    className="rounded-full border border-current/20 px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
                  >
                    Track
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {trackFor && (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await createTask({
                  title: trackFor,
                  projectId: taskProject || undefined,
                  pipelineStageId: taskStage.trim() || undefined,
                  emailId: message.id,
                });
                toast.success("Task saved");
                setTrackFor(null);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save the task");
              }
            }}
          >
            <select
              aria-label="Project"
              value={taskProject}
              onChange={(event) => setTaskProject(event.target.value)}
              className="rounded-lg border border-current/20 bg-transparent px-2 py-1 text-xs"
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
              className="rounded-lg border border-current/20 bg-transparent px-2 py-1 text-xs"
            />
            <button type="submit" className="rounded-full bg-highlight px-3 py-1 text-xs text-white">
              Save task
            </button>
          </form>
        )}
        {message.chartData && (
          <div className="mt-2">
            <ChartRenderer chart={message.chartData} />
          </div>
        )}
      </div>
    </div>
  );
}