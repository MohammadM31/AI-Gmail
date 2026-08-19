import { useState } from "react";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ThemeToggle } from "./components/Shared/ThemeToggle";
import { Composer } from "./components/EmailComposer/Composer";
import { ThreadView } from "./components/EmailView/ThreadView";
import { ContactManager } from "./components/Contacts/ContactManager";
import { TemplateManager } from "./components/Templates/TemplateManager";
import { Analytics } from "./components/Dashboard/Analytics";
import { Settings } from "./components/Settings/Settings";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { useUserStore } from "./stores/userStore";
import type { NavView } from "./types";

const TITLES: Record<NavView, string> = {
  compose: "Compose",
  inbox: "Inbox",
  contacts: "Contacts",
  templates: "Templates",
  analytics: "Analytics",
  settings: "Settings",
};

export default function App() {
  const user = useUserStore((s) => s.user);
  const [view, setView] = useState<NavView>("compose");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen flex bg-bg-light dark:bg-bg-dark">
      <Sidebar active={view} onSelect={setView} />
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-4 py-3">
          <span className="font-medium text-sm">{TITLES[view]}</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              title={user.name}
              className="h-8 w-8 rounded-full bg-accent-light dark:bg-accent-dark flex items-center justify-center text-xs text-white"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 max-w-4xl w-full mx-auto">
          {view === "compose" && (
            <Composer key={pendingPrompt ?? "compose"} initialPrompt={pendingPrompt ?? undefined} />
          )}
          {view === "inbox" && <ThreadView />}
          {view === "contacts" && <ContactManager />}
          {view === "templates" && (
            <TemplateManager
              onUse={(prompt) => {
                setPendingPrompt(prompt);
                setView("compose");
              }}
            />
          )}
          {view === "analytics" && <Analytics />}
          {view === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
}
