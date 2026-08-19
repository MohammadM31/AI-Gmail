import type { NavView } from "../../types";

const NAV_ITEMS: { key: NavView; label: string }[] = [
  { key: "compose", label: "Compose" },
  { key: "inbox", label: "Inbox" },
  { key: "contacts", label: "Contacts" },
  { key: "templates", label: "Templates" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
];

export function Sidebar({ active, onSelect }: { active: NavView; onSelect: (v: NavView) => void }) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
      <div className="mb-4 text-lg font-semibold">AI Email</div>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          className={`text-left rounded-lg px-3 py-2 text-sm transition ${
            active === item.key
              ? "bg-accent-light/10 dark:bg-accent-dark/40 font-medium"
              : "hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          {item.label}
        </button>
      ))}
    </aside>
  );
}
