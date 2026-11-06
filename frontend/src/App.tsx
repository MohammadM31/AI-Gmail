// frontend/src/App.tsx

import {
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { connectSocket, disconnectSocket } from "./services/socketService";
import { useMailEvents } from "./hooks/useMailEvents";

import {
  useUserStore,
} from "./stores/userStore";

import { API_URL, createTask, listProjectsSummary } from "./services/apiClient";

import {
  AuthScreen,
} from "./components/Auth/AuthScreen";

import {
  Sidebar,
} from "./components/Sidebar/Sidebar";

import {
  ThemeToggle,
} from "./components/Shared/ThemeToggle";

import {
  Composer,
} from "./components/EmailComposer/Composer";

import {
  ThreadView,
} from "./components/EmailView/ThreadView";

import {
  EmailList,
} from "./components/EmailView/EmailList";

import {
  ContactManager,
} from "./components/Contacts/ContactManager";

import {
  TemplateManager,
} from "./components/Templates/TemplateManager";

import {
  Analytics,
} from "./components/Dashboard/Analytics";

import {
  Settings,
} from "./components/Settings/Settings";

import {
  ErrorBoundary,
} from "./components/Shared/ErrorBoundary";

import {
  EmailItem,
  ProjectSummary,
} from "./types";

const ACTIONABLE = /\b(send|review|prepare|decide|schedule|call|update|confirm|share)\b/i;

import {
  PipelineDashboard,
} from "./components/Pipeline/PipelineDashboard";

import {
  RequirementsDashboard,
} from "./components/Requirements/RequirementsDashboard";

import {
  ProjectsDashboard,
} from "./components/Requirements/ProjectsDashboard";

import {
  ConversationProjects,
} from "./components/Projects/ConversationProjects";

import type {
  NavView,
  User,
} from "./types";

interface ComposerState {
  text: string;

  recipients: {
    name: string;
    email: string | null;
  }[];

  attachments: any[];

  result: any;

  saved: boolean;
}

// Views hidden from each kind of user. Staff (any staffRole) see everything;
// CLIENT users don't get the internal tooling.
const CLIENT_HIDDEN_VIEWS: NavView[] = [
  "pipeline",
  "requirements",
  "analytics",
];

function getHiddenViews(
  user: User | null
): NavView[] {
  if (user?.role === "STAFF") {
    return [];
  }

  // CLIENT, or role not (yet) known: fail closed.
  return CLIENT_HIDDEN_VIEWS;
}

function App() {
  const {
    user,
    logout,
    setSession,
  } = useUserStore();

  const [sessionChecked, setSessionChecked] = useState(false);

  // The session lives in an httpOnly cookie. Confirm it before rendering.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/auth/me`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          logout();
          return;
        }
        if (!res.ok) return;

        const profile = await res.json();
        setSession(
          {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            organizationId: profile.organizationId,
            role: profile.role,
            staffRole: profile.staffRole ?? null,
          },
          null,
          profile.csrfToken ?? null
        );
      })
      .catch(() => {
        // The cookie cannot be read from here when the API is unreachable.
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [logout, setSession]);

  const hiddenViews = getHiddenViews(
    user
  );

  const [
    activeView,
    setActiveView,
  ] = useState<NavView>(
    "compose"
  );

  const [
    selectedEmail,
    setSelectedEmail,
  ] = useState<EmailItem | null>(
    null
  );

  const [
    selectedThreadId,
    setSelectedThreadId,
  ] = useState<string | null>(
    null
  );

  const [trackFor, setTrackFor] = useState<string | null>(null);
  const [taskProjects, setTaskProjects] = useState<ProjectSummary[]>([]);
  const [taskProject, setTaskProject] = useState("");
  const [taskStage, setTaskStage] = useState("");

  useEffect(() => {
    if (!selectedEmail?.bulletPoints.some((bullet) => ACTIONABLE.test(bullet))) return;
    listProjectsSummary().then(setTaskProjects).catch(() => setTaskProjects([]));
  }, [selectedEmail]);

  const [
    mobileNavOpen,
    setMobileNavOpen,
  ] = useState(false);

  const [
    composerState,
    setComposerState,
  ] = useState<ComposerState>({
    text: "",
    recipients: [],
    attachments: [],
    result: null,
    saved: false,
  });

  // If the signed-in user can't see the current view (e.g. a different
  // account signed in during the same session), fall back to Compose.
  useEffect(() => {
    if (
      user &&
      hiddenViews.includes(
        activeView
      )
    ) {
      setActiveView("compose");
    }
  }, [user, activeView]);

  // The socket is owned here: connect once per signed-in user. Mail events
  // are fanned out by socketService, so EmailList can subscribe as well.
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    connectSocket();
  }, [user]);

  useMailEvents((event) => {
    if (!user || event.type !== "received") return;
    toast.info("New mail", { description: event.subject });
  });

  const handleNavSelect = (
    view: NavView
  ) => {
    if (hiddenViews.includes(view)) {
      return;
    }

    if (view !== "inbox") {
      setSelectedEmail(null);
      setSelectedThreadId(null);
    }

    setActiveView(view);
    setMobileNavOpen(false);
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm opacity-60">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  function handleEmailSelect(
    email: EmailItem
  ) {
    setSelectedEmail(email);

    setSelectedThreadId(
      email.threadId ||
        email.id
    );

    setActiveView("inbox");
  }

  function handleBackToInbox() {
    setSelectedEmail(null);
    setSelectedThreadId(null);
    setActiveView("inbox");
  }

  function renderContent() {
    if (selectedThreadId) {
      return (
        <ThreadView
          threadId={
            selectedThreadId
          }
          onBack={
            handleBackToInbox
          }
        />
      );
    }

    if (selectedEmail) {
      return (
        <div className="space-y-4">

          <button
            onClick={
              handleBackToInbox
            }
            className="text-xs opacity-60 hover:opacity-100 underline"
          >
            ← Back to inbox
          </button>

          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">

            <h2 className="font-semibold">
              {
                selectedEmail.subject
              }
            </h2>

            <p className="text-xs opacity-60 mb-2">
              To:{" "}
              {selectedEmail.recipients
                .map(
                  (recipient) =>
                    recipient.name
                )
                .join(", ")}
            </p>

            <ul className="space-y-1 text-sm mb-3">

              {selectedEmail.bulletPoints.map(
                (
                  bullet,
                  index
                ) => (
                  <li
                    key={index}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="opacity-50">
                      •
                    </span>
                    <span>{bullet}</span>
                    {ACTIONABLE.test(bullet) && (
                      <button
                        type="button"
                        onClick={() => setTrackFor(trackFor === bullet ? null : bullet)}
                        className="rounded-full border border-black/10 dark:border-white/10 px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
                      >
                        Track
                      </button>
                    )}
                  </li>
                )
              )}

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
                      emailId: selectedEmail.id,
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
                  className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs"
                >
                  <option value="">Project</option>
                  {taskProjects.map((project) => (
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

            <p className="text-sm opacity-70">
              {
                selectedEmail.content
              }
            </p>

            <div className="mt-3 text-xs opacity-50">
              Status:{" "}
              {
                selectedEmail.status
              }
            </div>

          </div>

        </div>
      );
    }

    switch (activeView) {
      case "compose":
        return (
          <Composer
            key="composer"
            threadId={null}
            onEmailSent={() => {}}
            externalState={
              composerState
            }
            onStateChange={
              setComposerState
            }
          />
        );

      case "inbox":
        return (
          <EmailList
            onSelect={
              handleEmailSelect
            }
          />
        );

      case "contacts":
        return (
          <ContactManager />
        );

      case "pipeline":
        return (
          <PipelineDashboard />
        );

      case "projects":
        return user?.role === "STAFF" ? (
          <ProjectsDashboard />
        ) : (
          <ConversationProjects />
        );

      case "requirements":
        return (
          <RequirementsDashboard />
        );

      case "templates":
        return (
          <TemplateManager
            onUse={(prompt) => {
              setComposerState(
                (previous) => ({
                  ...previous,
                  text: prompt,
                })
              );

              handleNavSelect(
                "compose"
              );
            }}
          />
        );

      case "analytics":
        return (
          <Analytics />
        );

      case "settings":
        return (
          <Settings />
        );

      default:
        return (
          <Composer
            key="composer"
            threadId={null}
            onEmailSent={() => {}}
            externalState={
              composerState
            }
            onStateChange={
              setComposerState
            }
          />
        );
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-bg-light dark:bg-bg-dark text-ink-light dark:text-ink-dark">

        <Sidebar
          active={activeView}
          onSelect={
            handleNavSelect
          }
          hiddenViews={
            hiddenViews
          }
          mobileOpen={
            mobileNavOpen
          }
          onMobileClose={() =>
            setMobileNavOpen(
              false
            )
          }
        />

        <div className="flex-1 flex flex-col overflow-hidden">

          <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark">

            <div className="flex items-center gap-3">

              <button
                onClick={() =>
                  setMobileNavOpen(
                    true
                  )
                }
                aria-label="Open menu"
                className="md:hidden rounded-lg p-1.5 -ml-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
              >
                ☰
              </button>

              <h1 className="text-lg font-semibold">

                {activeView ===
                  "compose" &&
                  "Compose"}

                {activeView ===
                  "inbox" &&
                  "Inbox"}

                {activeView ===
                  "contacts" &&
                  "Contacts"}

                {activeView ===
                  "pipeline" &&
                  "Pipelines"}

                {activeView ===
                  "projects" &&
                  "Projects"}

                {activeView ===
                  "requirements" &&
                  "Requirements"}

                {activeView ===
                  "templates" &&
                  "Templates"}

                {activeView ===
                  "analytics" &&
                  "Analytics"}

                {activeView ===
                  "settings" &&
                  "Settings"}

              </h1>

            </div>

            <ThemeToggle />

          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {renderContent()}
          </main>

        </div>

      </div>
    </ErrorBoundary>
  );
}

export default App;
