// frontend/src/components/Requirements/ProjectsDashboard.tsx
import { FormEvent, useEffect, useState } from "react";

import {
  listProjectsSummary,
  listClientsInOrg,
  createProject,
} from "../../services/apiClient";

import type { ClientUser, ProjectSummary } from "../../types";

const INPUT_CLASS =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none";

// Only render stored URLs as links when they're plain http(s); anything else
// (e.g. a javascript: URL that slipped past server validation) stays text.
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function UrlLine({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;

  return (
    <div className="flex gap-2 text-xs min-w-0">
      <span className="opacity-40 shrink-0">{label}</span>
      {isHttpUrl(url) ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate underline opacity-70 hover:opacity-100"
        >
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

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [clientUserId, setClientUserId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError(null);

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

  function resetForm() {
    setClientUserId("");
    setName("");
    setDescription("");
    setRepositoryUrl("");
    setApplicationUrl("");
    setFormError(null);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!clientUserId || !trimmedName) {
      setFormError("Choose a client and enter a project name.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      await createProject({
        clientUserId,
        name: trimmedName,
        // The API rejects empty strings for the optional fields, so only
        // send the ones that were filled in.
        description: description.trim() || undefined,
        repositoryUrl: repositoryUrl.trim() || undefined,
        applicationUrl: applicationUrl.trim() || undefined,
      });

      closeForm();
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create project"
      );
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
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 p-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Projects</h2>
          <p className="text-sm opacity-50 mt-1">
            Active projects, grouped by the client they belong to.
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            New Project
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 space-y-4"
        >
          <h3 className="text-sm font-medium">New project</h3>

          {formError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 px-3 py-2 text-sm">
              {formError}
            </div>
          )}

          <label className="block text-xs opacity-70">
            Client
            <select
              className={`mt-1 ${INPUT_CLASS}`}
              value={clientUserId}
              onChange={(e) => setClientUserId(e.target.value)}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
            {clients.length === 0 && (
              <span className="block mt-1 opacity-70">
                There are no client users in your organization yet.
              </span>
            )}
          </label>

          <label className="block text-xs opacity-70">
            Name
            <input
              className={`mt-1 ${INPUT_CLASS}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
            />
          </label>

          <label className="block text-xs opacity-70">
            Description
            <textarea
              className={`mt-1 ${INPUT_CLASS}`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs opacity-70">
              Repository URL
              <input
                className={`mt-1 ${INPUT_CLASS}`}
                type="url"
                placeholder="https://github.com/…"
                value={repositoryUrl}
                onChange={(e) => setRepositoryUrl(e.target.value)}
              />
            </label>

            <label className="block text-xs opacity-70">
              App URL
              <input
                className={`mt-1 ${INPUT_CLASS}`}
                type="url"
                placeholder="https://…"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || clients.length === 0}
              className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create project"}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className="text-xs underline opacity-70 hover:opacity-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="border border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center text-sm opacity-50">
          No active projects yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{project.name}</h3>
                  <p className="text-xs opacity-60 mt-0.5">
                    {project.clientName ?? "Unknown client"}
                  </p>
                </div>

                <span className="shrink-0 text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/5">
                  {project.status}
                </span>
              </div>

              {project.description && (
                <p className="text-sm opacity-75">{project.description}</p>
              )}

              <div className="space-y-1">
                <UrlLine label="Repo" url={project.repositoryUrl} />
                <UrlLine label="App" url={project.applicationUrl} />
              </div>

              <div className="flex gap-6 pt-4 border-t border-black/10 dark:border-white/10">
                <div>
                  <div className="text-lg font-semibold">
                    {project.requirementCount}
                  </div>
                  <div className="text-[11px] opacity-50">Requirements</div>
                </div>

                <div>
                  <div
                    className={`text-lg font-semibold ${
                      project.pendingModificationCount > 0
                        ? "text-yellow-600 dark:text-yellow-400"
                        : ""
                    }`}
                  >
                    {project.pendingModificationCount}
                  </div>
                  <div className="text-[11px] opacity-50">Pending review</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
