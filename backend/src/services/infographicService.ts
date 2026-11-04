import { spawn } from "child_process";
import path from "path";
import { randomUUID } from "crypto";
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

const BUCKET = process.env.SUPABASE_ATTACHMENTS_BUCKET ?? "attachments";
const SCRIPT = path.join(__dirname, "../../scripts/render_infographic.py");

export interface GraphicSpec {
  kind: "chart" | "facts";
  type?: string;
  title?: string;
  labels?: string[];
  values?: number[];
  facts?: string[];
}

export async function renderInfographic(spec: GraphicSpec): Promise<Buffer | null> {
  const commands = process.platform === "win32" ? ["py", "python"] : ["python3", "python"];
  for (const command of commands) {
    const png = await run(command, spec);
    if (png) return png;
  }
  logger.warn("matplotlib infographic was not rendered");
  return null;
}

function run(command: string, spec: GraphicSpec): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const args = command === "py" ? ["-3", SCRIPT] : [SCRIPT];
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 15000);
    child.stdout.on("data", (chunk) => out.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => err.push(Buffer.from(chunk)));
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.warn({ command, detail: Buffer.concat(err).toString("utf8").slice(0, 300) }, "infographic script failed");
        resolve(null);
        return;
      }
      const png = Buffer.concat(out);
      resolve(png.length > 32 ? png : null);
    });
    child.stdin.write(JSON.stringify(spec));
    child.stdin.end();
  });
}

export async function storeInfographic(
  organizationId: string,
  userId: string,
  spec: GraphicSpec
): Promise<string | null> {
  const png = await renderInfographic(spec);
  if (!png) return null;
  const storagePath = `${organizationId}/${userId}/infographics/${randomUUID()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, png, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) {
    logger.warn({ message: error.message }, "infographic upload failed");
    return null;
  }
  return storagePath;
}

export interface ChartPayload {
  type: string;
  title: string;
  labels: string[];
  values: number[];
  facts?: string[];
  imagePath?: string;
}

export function chartSpec(chart: {
  type?: string;
  title?: string;
  labels?: unknown;
  values?: unknown;
} | null): GraphicSpec | null {
  if (!chart) return null;
  const labels = Array.isArray(chart.labels) ? chart.labels.map(String) : [];
  const values = Array.isArray(chart.values)
    ? chart.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    : [];
  if (labels.length === 0 || values.length === 0 || labels.length !== values.length) return null;
  const type = chart.type === "line" || chart.type === "pie" ? chart.type : "bar";
  return { kind: "chart", type, title: chart.title ?? "", labels, values };
}

export function factSpec(graphic: { title?: string; facts?: unknown } | null): GraphicSpec | null {
  if (!graphic || !Array.isArray(graphic.facts)) return null;
  const facts = graphic.facts.filter((fact): fact is string => typeof fact === "string" && fact.trim().length > 0);
  if (facts.length === 0) return null;
  return { kind: "facts", title: graphic.title ?? "", facts: facts.slice(0, 4) };
}
