import { useEffect, useState } from "react";
import type { Template } from "../../types";
import { listTemplates } from "../../services/apiClient";

export function TemplateSelector({ onSelect }: { onSelect: (prompt: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
  }, []);

  if (!templates.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {templates.slice(0, 4).map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.prompt)}
          className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
