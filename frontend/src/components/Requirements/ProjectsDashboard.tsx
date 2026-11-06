// frontend/src/components/Requirements/ProjectsDashboard.tsx
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  listProjectsSummary,
  listClientsInOrg,
  createProject,
  updateProject,
  syncProjectDetails,
  createDigest,
  listTasks,
} from "../../services/apiClient";

import type { ClientUser, ProjectSummary, Task } from "../../types";

const INPUT_CLASS =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-surface-dark px-3 py-1.5 text-sm outline-none";

type Section = "details" | "statistics" | "pictures";

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function UrlLine({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <div className="flex gap-2 text-xs min-w-0">
      <span className="opacity-40 shrink-0">{label}</span>
      {isHttpUrl(url) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="truncate underline opacity-70 hover:opacity-100">
          {url}
        </a>
      ) : (
        <span className="truncate opacity-70">{url}</span>
      )}
    </div>
  );
}

export function ProjectsDashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [screen, setScreen] = useState<"list" | "create" | "project">("list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("details");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientChoice, setClientChoice] = useState("");
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [digestContact, setDigestContact] = useState("");
  const [digestNote, setDigestNote] = useState<string | null>(null);

  async function requestDigest(scope: "daily" | "contact") {
    try {
      setDigestNote(null);
      const result = await createDigest({
        scope,
        contactId: scope === "contact" ? digestContact : undefined,
      });
      setDigestNote(result.emailId ? "Digest is in your inbox." : "Digest requested.");
    } catch (err) {
      setDigestNote(err instanceof Error ? err.message : "Could not build the digest");
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      await syncProjectDetails().catch(() => undefined);
      const [projectsData, clientsData] = await Promise.all([
        listProjectsSummary(),
        listClientsInOrg(),
      ]);
      setProjects(projectsData);
      setClients(clientsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const clientNames = useMemo(
    () => Array.from(new Set(projects.map((project) => project.clientName || "Unknown client"))).sort(),
    [projects]
  );

  const visible = projects.filter((project) => {
    const client = project.clientName || "Unknown client";
    if (clientFilter !== "all" && client !== clientFilter) return false;
    const haystack = `${project.name} ${client}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const openProject = projects.find((project) => project.id === openId) ?? null;

  function resetForm() {
    setClientChoice("");
    setName("");
    setDetails("");
    setRepositoryUrl("");
    setApplicationUrl("");
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const [kind, id] = clientChoice.split(":");
    if (!id || !name.trim()) {
      setFormError("Choose a client and enter a project name.");
      return;
    }
    try {
      setSubmitting(true);
      setFormError(null);
      await createProject({
        ...(kind === "contact" ? { contactId: id } : { clientUserId: id }),
        name: name.trim(),
        description: details.trim() || undefined,
        repositoryUrl: repositoryUrl.trim() || undefined,
        applicationUrl: applicationUrl.trim() || undefined,
      });
      resetForm();
      setScreen("list");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm opacity-60">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 p-4 text-sm">{error}</div>
      )}

      {screen === "list" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Client Projects</h2>
              <p className="text-sm opacity-50 mt-1">Search by the project name or its client.</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setScreen("create");
              }}
              className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              Add a new project
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => requestDigest("daily")}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              Daily digest
            </button>
            <select
              aria-label="Digest contact"
              value={digestContact}
              onChange={(event) => setDigestContact(event.target.value)}
              className={`${INPUT_CLASS} max-w-xs focus-visible:ring-2 focus-visible:ring-highlight`}
            >
              <option value="">Contact for a digest</option>
              {clients.filter((client) => client.kind !== "contact").map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => requestDigest("contact")}
              disabled={!digestContact}
              className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
            >
              Contact digest
            </button>
            {digestNote && <span className="text-xs opacity-70">{digestNote}</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className={`max-w-sm ${INPUT_CLASS} focus-visible:ring-2 focus-visible:ring-highlight`}
            />
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className={INPUT_CLASS + " max-w-xs"}
            >
              <option value="all">All clients</option>
              {clientNames.map((client) => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="border border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center text-sm opacity-50">
              No projects match.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setOpenId(project.id);
                    setSection("details");
                    setScreen("project");
                  }}
                  className="text-left rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <h3 className="font-medium truncate">{project.name}</h3>
                  <p className="text-xs opacity-60 mt-1">{project.clientName ?? "Unknown client"}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {screen === "create" && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 space-y-4">
          <button type="button" onClick={() => setScreen("list")} className="text-xs underline opacity-60">
            ← Projects
          </button>
          <h3 className="text-sm font-medium">New project</h3>
          {formError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 px-3 py-2 text-sm">{formError}</div>
          )}
          <label className="block text-xs opacity-70">
            Name
            <input className={`mt-1 ${INPUT_CLASS}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
          </label>
          <label className="block text-xs opacity-70">
            Client
            <select className={`mt-1 ${INPUT_CLASS}`} value={clientChoice} onChange={(event) => setClientChoice(event.target.value)} required>
              <option value="">Select a client…</option>
              {clients.map((client) => (
                <option key={`${client.kind ?? "user"}:${client.id}`} value={`${client.kind ?? "user"}:${client.id}`}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
            {clients.length === 0 && (
              <span className="block mt-1 opacity-70">Add a contact, or invite a client into the organization.</span>
            )}
          </label>
          <label className="block text-xs opacity-70">
            Project details
            <textarea
              className={`mt-1 ${INPUT_CLASS}`}
              rows={8}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={5000}
              placeholder="The general idea, the way a short readme would describe it."
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs opacity-70">
              Repository URL <span className="opacity-50">(optional)</span>
              <input className={`mt-1 ${INPUT_CLASS}`} type="url" placeholder="https://github.com/…" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} />
            </label>
            <label className="block text-xs opacity-70">
              App URL <span className="opacity-50">(optional)</span>
              <input className={`mt-1 ${INPUT_CLASS}`} type="url" placeholder="https://…" value={applicationUrl} onChange={(event) => setApplicationUrl(event.target.value)} />
            </label>
          </div>
          <button type="submit" disabled={submitting || clients.length === 0} className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {submitting ? "Creating..." : "Create project"}
          </button>
        </form>
      )}

      {screen === "project" && openProject && (
        <ProjectPage
          project={openProject}
          section={section}
          onBack={() => setScreen("list")}
          onSection={setSection}
          onUpdated={(next) => {
            setProjects((current) =>
              current.map((item) => (item.id === next.id ? { ...item, ...next } : item))
            );
          }}
        />
      )}
    </div>
  );
}

function ProjectTasks({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    listTasks(projectId).then(setTasks).catch(() => setTasks([]));
  }, [projectId]);

  return (
    <section className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-2">
      <h3 className="text-sm font-medium">Tasks</h3>
      {tasks.length === 0 ? (
        <p className="text-xs opacity-60">No tasks for this project yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {tasks.map((task) => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectPage({
  project,
  section,
  onBack,
  onSection,
  onUpdated,
}: {
  project: ProjectSummary;
  section: Section;
  onBack: () => void;
  onSection: (section: Section) => void;
  onUpdated: (project: ProjectSummary) => void;
}) {
  const tabs: { id: Section; label: string }[] = [
    { id: "details", label: "Project details" },
    { id: "statistics", label: "Statistics" },
    { id: "pictures", label: "Pictures" },
  ];

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-xs underline opacity-60">← Projects</button>
      <div>
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <p className="text-sm opacity-60">{project.clientName ?? "Unknown client"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSection(tab.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              section === tab.id ? "bg-highlight text-white" : "border border-black/10 dark:border-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === "details" && (
        <>
          <DetailsEditor project={project} onUpdated={onUpdated} />
          <ProjectTasks projectId={project.id} />
        </>
      )}

      {section === "statistics" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Requirements" value={String(project.requirementCount)} />
          <Stat label="Pending review" value={String(project.pendingModificationCount)} />
          <Stat label="Status" value={project.status} />
        </div>
      )}

      {section === "pictures" && (
        <div className="border border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center text-sm opacity-50">
          Picture data for this project shows up here.
        </div>
      )}
    </section>
  );
}

function DetailsEditor({
  project,
  onUpdated,
}: {
  project: ProjectSummary;
  onUpdated: (project: ProjectSummary) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(project.description ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState(project.repositoryUrl ?? "");
  const [applicationUrl, setApplicationUrl] = useState(project.applicationUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setDetails(project.description ?? "");
    setRepositoryUrl(project.repositoryUrl ?? "");
    setApplicationUrl(project.applicationUrl ?? "");
    setError(null);
  }, [project.id, project.description, project.repositoryUrl, project.applicationUrl]);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const saved = await updateProject(project.id, {
        description: details.trim() || null,
        repositoryUrl: repositoryUrl.trim() || null,
        applicationUrl: applicationUrl.trim() || null,
      });
      onUpdated({ ...project, ...saved });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the project details");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <article className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Readme</h3>
          <button
            onClick={() => setEditing(true)}
            className="rounded-full bg-highlight px-3 py-1 text-xs font-medium text-white"
          >
            Edit details
          </button>
        </div>
        <p className="text-sm whitespace-pre-wrap opacity-80">
          {project.description?.trim() || "No project details yet."}
        </p>
        <p className="text-xs opacity-50">
          An email that uses this project’s name adds its new facts here.
        </p>
        <UrlLine label="Repo" url={project.repositoryUrl} />
        <UrlLine label="App" url={project.applicationUrl} />
      </article>
    );
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 space-y-4">
      <h3 className="text-sm font-medium">Edit details</h3>
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 px-3 py-2 text-sm">{error}</div>
      )}
      <label className="block text-xs opacity-70">
        Project details
        <textarea
          className={`mt-1 ${INPUT_CLASS}`}
          rows={8}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={5000}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-xs opacity-70">
          Repository URL <span className="opacity-50">(optional)</span>
          <input className={`mt-1 ${INPUT_CLASS}`} type="url" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} />
        </label>
        <label className="block text-xs opacity-70">
          App URL <span className="opacity-50">(optional)</span>
          <input className={`mt-1 ${INPUT_CLASS}`} type="url" value={applicationUrl} onChange={(event) => setApplicationUrl(event.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "Saving..." : "Save details"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs underline opacity-70">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs opacity-50 mt-1">{label}</div>
    </div>
  );
}
