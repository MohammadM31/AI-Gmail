import { useState } from "react";
import type { AiProcessResult } from "../../types";
import { ChartRenderer } from "../Shared/ChartRenderer";

export function SplitView({ result }: { result: AiProcessResult }) {
  const [bullets, setBullets] = useState(result.bulletPoints);

  function updateBullet(i: number, value: string) {
    setBullets((prev) => prev.map((b, idx) => (idx === i ? value : b)));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-surface-light dark:bg-surface-dark">
        <div className="mb-2 text-xs uppercase tracking-wide opacity-60">
          Subject: {result.subject} · Tone: {result.tone}
        </div>
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="opacity-50">•</span>
              <input
                className="w-full bg-transparent outline-none border-b border-transparent focus:border-accent-light dark:focus:border-accent-dark"
                value={b}
                onChange={(e) => updateBullet(i, e.target.value)}
              />
            </li>
          ))}
        </ul>
      </div>

      {result.chart ? (
        <ChartRenderer chart={result.chart} />
      ) : (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-4 flex items-center justify-center text-sm opacity-50">
          No numeric data detected — no chart generated
        </div>
      )}
    </div>
  );
}
