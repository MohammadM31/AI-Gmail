import type { NavView } from "../../types";

const NAV_ITEMS: { key: NavView; label: string }[] = [
  { key: "compose", label: "Compose" },
  { key: "inbox", label: "Inbox" },
  { key: "contacts", label: "Contacts" },
  { key: "templates", label: "Templates" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
];

interface SidebarProps {
  active: NavView;
  onSelect: (v: NavView) => void;
  // Mobile-only: renders as a slide-in drawer instead of the
  // persistent desktop rail when these are provided.
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavList({ active, onSelect }: { active: NavView; onSelect: (v: NavView) => void }) {
  return (
    <>
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
    </>
  );
}

export function Sidebar({ active, onSelect, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop: persistent rail */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <div className="mb-4 text-lg font-semibold">AI Email</div>
        <NavList
          active={active}
          onSelect={onSelect}
        />
      </aside>

      {/* Mobile: slide-in drawer, only in the DOM while open */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80%] h-full flex flex-col gap-1 bg-surface-light dark:bg-surface-dark p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold">AI Email</span>
              <button
                onClick={onMobileClose}
                aria-label="Close menu"
                className="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <NavList
              active={active}
              onSelect={(v) => {
                onSelect(v);
                onMobileClose?.();
              }}
            />
          </aside>
        </div>
      )}
    </>
  );
}