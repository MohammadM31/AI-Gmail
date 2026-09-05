// frontend/src/App.tsx
import { useState, useEffect } from "react";
import { useUserStore } from "./stores/userStore";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ThemeToggle } from "./components/Shared/ThemeToggle";
import { Composer } from "./components/EmailComposer/Composer";
import { ThreadView } from "./components/EmailView/ThreadView";
import { EmailList } from "./components/EmailView/EmailList";
import { ContactManager } from "./components/Contacts/ContactManager";
import { TemplateManager } from "./components/Templates/TemplateManager";
import { Analytics } from "./components/Dashboard/Analytics";
import { Settings } from "./components/Settings/Settings";
import { ErrorBoundary } from "./components/Shared/ErrorBoundary";
import { EmailItem } from "./types";

type NavView = "compose" | "inbox" | "contacts" | "templates" | "analytics" | "settings";

// ✅ Composer state stored at App level to persist across tab switches
interface ComposerState {
  text: string;
  recipients: { name: string; email: string | null }[];
  attachments: any[];
  result: any;
  saved: boolean;
}

function App() {
  const { user } = useUserStore();
  const [activeView, setActiveView] = useState<NavView>("compose");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // ✅ Persist composer state across tab switches
  const [composerState, setComposerState] = useState<ComposerState>({
    text: "",
    recipients: [],
    attachments: [],
    result: null,
    saved: false,
  });

  // ✅ Reset composer when navigating away from compose
  const resetComposer = () => {
    setComposerState({
      text: "",
      recipients: [],
      attachments: [],
      result: null,
      saved: false,
    });
  };

  // ✅ Handle navigation - clears selected states when switching tabs
  const handleNavSelect = (view: NavView) => {
    // Clear selected email/thread when navigating away from inbox
    if (view !== "inbox") {
      setSelectedEmail(null);
      setSelectedThreadId(null);
    }
    setActiveView(view);
    setMobileNavOpen(false);
  };

  if (!user) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  function handleEmailSelect(email: EmailItem) {
    setSelectedEmail(email);
    setSelectedThreadId(email.threadId || email.id);
    setActiveView("inbox");
  }

  function handleBackToInbox() {
    setSelectedEmail(null);
    setSelectedThreadId(null);
    setActiveView("inbox");
  }

  function renderContent() {
    // ✅ Show ThreadView when a thread is selected
    if (selectedThreadId) {
      return (
        <ThreadView
          threadId={selectedThreadId}
          onBack={handleBackToInbox}
        />
      );
    }

    // ✅ Show EmailDetail when an email is selected but no thread
    if (selectedEmail) {
      return (
        <div className="space-y-4">
          <button
            onClick={handleBackToInbox}
            className="text-xs opacity-60 hover:opacity-100 underline"
          >
            ← Back to inbox
          </button>
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
            <h2 className="font-semibold">{selectedEmail.subject}</h2>
            <p className="text-xs opacity-60 mb-2">
              To: {selectedEmail.recipients.map((r) => r.name).join(", ")}
            </p>
            <ul className="space-y-1 text-sm mb-3">
              {selectedEmail.bulletPoints.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="opacity-50">•</span>
                  {b}
                </li>
              ))}
            </ul>
            <p className="text-sm opacity-70">{selectedEmail.content}</p>
            <div className="mt-3 text-xs opacity-50">
              Status: {selectedEmail.status}
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
            // ✅ Pass composer state and setter
            externalState={composerState}
            onStateChange={setComposerState}
          />
        );
      case "inbox":
        return <EmailList onSelect={handleEmailSelect} />;
      case "contacts":
        return <ContactManager />;
      case "templates":
        return (
          <TemplateManager
            onUse={(prompt) => {
              setComposerState((prev) => ({ ...prev, text: prompt }));
              handleNavSelect("compose");
            }}
          />
        );
      case "analytics":
        return <Analytics />;
      case "settings":
        return <Settings />;
      default:
        return (
          <Composer
            key="composer"
            threadId={null}
            onEmailSent={() => {}}
            externalState={composerState}
            onStateChange={setComposerState}
          />
        );
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-bg-light dark:bg-bg-dark text-ink-light dark:text-ink-dark">
        <Sidebar
          active={activeView}
          onSelect={handleNavSelect}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-6 py-3 border-b border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
                className="md:hidden rounded-lg p-1.5 -ml-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-xl leading-none"
              >
                ☰
              </button>
              <h1 className="text-lg font-semibold">
                {activeView === "compose" && "Compose"}
                {activeView === "inbox" && "Inbox"}
                {activeView === "contacts" && "Contacts"}
                {activeView === "templates" && "Templates"}
                {activeView === "analytics" && "Analytics"}
                {activeView === "settings" && "Settings"}
              </h1>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;