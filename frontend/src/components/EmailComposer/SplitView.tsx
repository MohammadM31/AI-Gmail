import { useState } from "react";
import type { AiProcessResult, ChartData, ChartKind } from "../../types";
import { ChartRenderer } from "../Shared/ChartRenderer";

const CHART_KINDS: ChartKind[] = ["bar", "line", "pie"];

interface SplitViewProps {
  result: AiProcessResult;
  /** Reports edits so the composer sends exactly what the sender sees. */
  onChange?: (patch: Partial<Pick<AiProcessResult, "bulletPoints" | "chart">>) => void;
}

export function SplitView({ result, onChange }: SplitViewProps) {
  const [bullets, setBullets] = useState(result.bulletPoints);
  const [chart, setChart] = useState<ChartData | null>(result.chart);

  function updateBullet(i: number, value: string) {
    const next = bullets.map((b, idx) => (idx === i ? value : b));
    setBullets(next);
    onChange?.({ bulletPoints: next });
  }

  function updateChart(patch: Partial<ChartData>) {
    if (!chart) return;
    const next: ChartData = { ...chart, ...patch };
    // The stored PNG has the old type and title drawn into it, and a hidden graphic must not ship a PNG.
    if (
      patch.enabled === false ||
      (patch.type !== undefined && patch.type !== chart.type) ||
      (patch.title !== undefined && patch.title !== chart.title)
    ) {
      delete next.imagePath;
    }
    setChart(next);
    onChange?.({ chart: next });
  }

  const graphicOn = !!chart && chart.enabled !== false;
  const graphicHasData =
    !!chart && ((chart.labels?.length ?? 0) > 0 || (chart.facts?.length ?? 0) > 0 || !!chart.imagePath);

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
                dir="auto"
                className="w-full bg-transparent outline-none border-b border-transparent focus:border-accent-light dark:focus:border-accent-dark"
                value={b}
                onChange={(e) => updateBullet(i, e.target.value)}
              />
            </li>
          ))}
        </ul>
      </div>

      {chart ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={graphicOn}
                disabled={!graphicHasData}
                onChange={(e) => updateChart({ enabled: e.target.checked })}
              />
              Show graphic
            </label>
            {graphicOn && chart.type !== "facts" && (
              <select
                aria-label="Chart type"
                className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                value={CHART_KINDS.includes(chart.type as ChartKind) ? chart.type : "bar"}
                onChange={(e) => updateChart({ type: e.target.value })}
              >
                {CHART_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind[0].toUpperCase() + kind.slice(1)}
                  </option>
                ))}
              </select>
            )}
            {graphicOn && (
              <input
                dir="auto"
                aria-label="Chart title"
                className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 outline-none"
                placeholder="Chart title"
                maxLength={100}
                value={chart.title ?? ""}
                onChange={(e) => updateChart({ title: e.target.value })}
              />
            )}
          </div>
          {graphicOn ? (
            <ChartRenderer chart={chart} />
          ) : (
            <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-4 text-center text-sm opacity-50">
              Graphic is off. The email will have bullets only.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-4 flex items-center justify-center text-sm opacity-50">
          No numeric data detected — no chart generated
        </div>
      )}
    </div>
  );
}
