// frontend/src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl === undefined || e.ctrlKey === shortcut.ctrl;
        const metaMatch = shortcut.meta === undefined || e.metaKey === shortcut.meta;
        const shiftMatch = shortcut.shift === undefined || e.shiftKey === shortcut.shift;
        const altMatch = shortcut.alt === undefined || e.altKey === shortcut.alt;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

// Pre-defined shortcut groups
export const SHORTCUTS = {
  COMPOSE: { key: "c", action: () => {} },
  SEARCH: { key: "k", meta: true, action: () => {} },
  SEND: { key: "Enter", meta: true, action: () => {} },
  SAVE_DRAFT: { key: "s", meta: true, action: () => {} },
  CLOSE: { key: "Escape", action: () => {} },
};