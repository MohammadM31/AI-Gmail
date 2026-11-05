import { useEffect, useState } from "react";
import {
  listConversationProjects,
  updateConversationProject,
  type ConversationBoard,
  type ConversationFact,
  type ConversationPhase,
} from "../../services/apiClient";

function blankFact(): ConversationFact {
  return { id: crypto.randomUUID(), label: "", value: "", edited: true };
}

function ProjectBoardCard({
  initial,
  onSaved,
}: {
  initial: ConversationBoard;
  onSaved: (board: ConversationBoard) => void;
}) {
  const [board, setBoard] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  function updatePhase(id: string, patch: Partial<ConversationPhase>) {
    setBoard((current) => ({
      ...current,
      phases: current.phases.map((phase) =>
        phase.id === id ? { ...phase, ...patch, edited: true } : phase
      ),
    }));
  }

  function updateFact(id: string, patch: Partial<ConversationFact>) {
    setBoard((current) => ({
      ...current,
      facts: current.facts.map((fact) =>
        fact.id === id ? { ...fact, ...patch, edited: true } : fact
      ),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateConversationProject(board.personId, {
        name: board.name,
        summary: board.summary,
        phases: board.phases.filter((phase) => phase.name.trim()),
        facts: board.facts.filter((fact) => fact.label.trim() && fact.value.trim()),
      });
      setBoard(saved);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project");
    } finally {
      setSaving(false);
    }
  }

  const lastIndex = board.phases.length - 1;

  return (
    <section className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 space-y-6">
      <div className="space-y-2">
        <p className="text-xs opacity-50">
          {board.personName}
          {board.conversationCount > 0
            ? ` · ${board.conversationCount} emails`
            : " · no emails yet"}
        </p>
        <input
          value={board.name}
          onChange={(event) => setBoard({ ...board, name: event.target.value })}
          className="w-full bg-transparent text-lg font-semibold outline-none"
          aria-label="Project name"
        />
        <textarea
          value={board.summary}
          onChange={(event) => setBoard({ ...board, summary: event.target.value })}
          rows={2}
          placeholder="What this project is"
          className="w-full bg-transparent text-sm opacity-80 outline-none resize-none"
        />
      </div>

      {board.phases.length === 0 ? (
        <p className="text-sm opacity-60">
          The timeline appears after an email conversation covers the work. Later phases stay hidden until the conversation reaches them.
        </p>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="relative min-w-[520px] pt-2">
            <div className="absolute left-4 right-4 top-5 border-t-2 border-dotted border-black/20 dark:border-white/20" />
            <ol className="relative flex justify-between gap-4">
              {board.phases.map((phase, index) => {
                const current = index === lastIndex;
                return (
                  <li key={phase.id} className="flex-1 min-w-[140px] space-y-3">
                    <div
                      className={`relative z-10 h-4 w-4 rounded-full border-2 ${
                        current
                          ? "bg-highlight border-highlight"
                          : "bg-surface-light dark:bg-surface-dark border-black/40 dark:border-white/40"
                      }`}
                    />
                    <div className="space-y-1">
                      <input
                        value={phase.name}
                        onChange={(event) => updatePhase(phase.id, { name: event.target.value })}
                        className="w-full bg-transparent text-sm font-medium outline-none"
                        aria-label="Phase name"
                      />
                      <textarea
                        value={phase.detail}
                        onChange={(event) => updatePhase(phase.id, { detail: event.target.value })}
                        rows={3}
                        className="w-full bg-transparent text-xs opacity-70 outline-none resize-none"
                        aria-label="Phase detail"
                      />
                      <input
                        type="date"
                        value={phase.date ?? ""}
                        onChange={(event) =>
                          updatePhase(phase.id, { date: event.target.value || null })
                        }
                        className="bg-transparent text-xs opacity-60 outline-none"
                        aria-label="Phase date"
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Project details</h3>
        {board.facts.length === 0 && (
          <p className="text-xs opacity-50">Dates and decisions from the conversation show up here.</p>
        )}
        {board.facts.map((fact) => (
          <div key={fact.id} className="grid grid-cols-[140px_1fr] gap-2">
            <input
              value={fact.label}
              onChange={(event) => updateFact(fact.id, { label: event.target.value })}
              placeholder="Label"
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs outline-none"
            />
            <input
              value={fact.value}
              onChange={(event) => updateFact(fact.id, { value: event.target.value })}
              placeholder="Detail"
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs outline-none"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setBoard({ ...board, facts: [...board.facts, blankFact()] })}
          className="text-xs underline opacity-60 hover:opacity-100"
        >
          Add a detail
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save edits"}
      </button>
    </section>
  );
}

export function ConversationProjects({ embedded = false }: { embedded?: boolean }) {
  const [boards, setBoards] = useState<ConversationBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listConversationProjects()
      .then((result) => {
        if (!cancelled) setBoards(result.boards);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not read the project");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          {embedded ? "From the conversation" : "Your project"}
        </h2>
        <p className="text-sm opacity-60">
          {embedded
            ? "Built from your email conversations. Only phases that have been reached are shown."
            : "Built from your emails with the admin. Only phases that have been reached are shown."}
        </p>
      </div>

      {loading && <p className="text-sm opacity-60">Reading the conversation…</p>}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 p-4 text-sm">
          {error}
        </div>
      )}
      {!loading && !error && boards.length === 0 && (
        <p className="text-sm opacity-60">No client conversation to show yet.</p>
      )}
      {boards.map((board) => (
        <ProjectBoardCard
          key={board.personId}
          initial={board}
          onSaved={(saved) =>
            setBoards((current) =>
              current.map((item) => (item.personId === saved.personId ? saved : item))
            )
          }
        />
      ))}
    </div>
  );
}
