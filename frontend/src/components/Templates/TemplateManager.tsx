import { useEffect, useState, FormEvent } from "react";
import type { Template } from "../../types";
import { listTemplates, createTemplate } from "../../services/apiClient";

export function TemplateManager({ onUse }: { onUse: (prompt: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    const template = await createTemplate({ name, prompt });
    setTemplates((prev) => [template, ...prev]);
    setName("");
    setPrompt("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-black/10 dark:border-white/10 p-4 bg-surface-light dark:bg-surface-dark">
        <input
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Prompt this template fills in…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
          Save template
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4"
          >
            <p className="font-medium text-sm">{t.name}</p>
            <p className="text-xs opacity-60 mt-1 line-clamp-2">{t.prompt}</p>
            <button
              onClick={() => onUse(t.prompt)}
              className="mt-3 text-xs underline opacity-70 hover:opacity-100"
            >
              Use in composer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
