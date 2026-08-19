import { useState } from "react";
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

function App() {
  const { user } = useUserStore();
  const [activeView, setActiveView] = useState<NavView>("compose");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  if (!user) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  function handleEmailSelect(email: EmailItem) {
    setSelectedEmail(email);
    setSelectedThreadId(email.threadId);
    setActiveView("inbox");
  }

  function handleBackToInbox() {
    setSelectedEmail(null);
    setSelectedThreadId(null);
    setActiveView("inbox");
  }

  function renderContent() {
    // If viewing a specific thread
    if (selectedThreadId) {
      return (
        <ThreadView
          threadId={selectedThreadId}
          onBack={handleBackToInbox}
        />
      );
    }

    // If viewing a specific email
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

    // Main views
    switch (activeView) {
      case "compose":
        return <Composer onEmailSent={() => {}} />;
      case "inbox":
        return <EmailList onSelect={handleEmailSelect} />;
      case "contacts":
        return <ContactManager />;
      case "templates":
        return <TemplateManager onUse={(prompt) => {
          setActiveView("compose");
          // The prompt will be used by the composer
        }} />;
      case "analytics":
        return <Analytics />;
      case "settings":
        return <Settings />;
      default:
        return <Composer onEmailSent={() => {}} />;
    }
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-bg-light dark:bg-bg-dark text-ink-light dark:text-ink-dark">
        <Sidebar active={activeView} onSelect={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-6 py-3 border-b border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark">
            <h1 className="text-lg font-semibold">
              {activeView === "compose" && "Compose"}
              {activeView === "inbox" && "Inbox"}
              {activeView === "contacts" && "Contacts"}
              {activeView === "templates" && "Templates"}
              {activeView === "analytics" && "Analytics"}
              {activeView === "settings" && "Settings"}
            </h1>
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