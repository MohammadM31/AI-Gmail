import { useThemeStore } from "../../stores/themeStore";

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="rounded-full px-3 py-1.5 text-sm font-medium border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark hover:opacity-80 transition"
    >
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
