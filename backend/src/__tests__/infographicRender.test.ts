import { spawnSync } from "child_process";
import path from "path";

const SCRIPT = path.join(__dirname, "../../scripts/render_infographic.py");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const CANDIDATES: [string, string[]][] = [
  ["python3", []],
  ["python", []],
  ["py", ["-3"]],
];

function findPython(): [string, string[]] | null {
  for (const [command, prefix] of CANDIDATES) {
    const probe = spawnSync(command, [...prefix, "--version"], { encoding: "utf8" });
    if (!probe.error && probe.status === 0) return [command, prefix];
  }
  return null;
}

const python = findPython();
// CI always runs this test: a missing Python there is a failure, not a skip.
const mustRun = Boolean(process.env.CI);

describe("matplotlib infographic renderer", () => {
  const title = "renders a one-bar spec to a PNG";

  if (!python && !mustRun) {
    it.skip(`${title} (skipped: python3/python not found; install Python and backend/requirements.txt)`, () => undefined);
    return;
  }

  it(title, () => {
    if (!python) {
      throw new Error("Python 3 is required to run the infographic renderer but was not found on PATH");
    }
    const [command, prefix] = python;
    const spec = {
      kind: "chart",
      type: "bar",
      title: "Client sales",
      labels: ["Decrease"],
      values: [70],
    };
    const result = spawnSync(command, [...prefix, SCRIPT], {
      input: JSON.stringify(spec),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });

    const stderr = result.stderr?.toString("utf8").slice(0, 500) ?? "";
    expect({ status: result.status, error: result.error?.message, stderr }).toEqual({
      status: 0,
      error: undefined,
      stderr: expect.not.stringContaining("Traceback"),
    });
    expect(result.stdout.length).toBeGreaterThan(32);
    expect(result.stdout.subarray(0, 4).equals(PNG_SIGNATURE)).toBe(true);
  });
});
