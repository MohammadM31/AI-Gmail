import { useThemeStore } from "../stores/themeStore";

// Thin hook wrapper so components can `import { useTheme }` without
// knowing it's backed by a zustand store.
export function useTheme() {
  return useThemeStore();
}
