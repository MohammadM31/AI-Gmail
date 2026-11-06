import express from "express";
import request from "supertest";
import { aiBudget, createAiBudget } from "../middleware/aiBudget";
import { errorHandler } from "../middleware/errorHandler";
import aiRoutes from "../routes/aiRoutes";

const HOUR_MS = 60 * 60 * 1000;
const ENV_KEYS = ["AI_BUDGET_USER_PER_HOUR", "AI_BUDGET_ORG_PER_HOUR"] as const;

function buildApp(clock?: () => number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const user = req.header("x-user");
    const org = req.header("x-org");
    if (user && org) req.auth = { userId: user, organizationId: org };
    next();
  });
  const budget = createAiBudget(clock ? { now: clock } : {});
  app.post("/generate", budget, (req, res) => {
    if (req.body?.bad) return res.status(400).json({ error: { message: "bad body" } });
    if (req.body?.boom) return res.status(503).json({ error: { message: "ai down" } });
    res.json({ ok: true });
  });
  app.get("/mailbox", (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

const as = (app: express.Express, user: string, org: string) => ({
  generate: (body: object = {}) =>
    request(app).post("/generate").set("x-user", user).set("x-org", org).send(body),
});

describe("aiBudget", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("defaults to 10 per user per hour and returns a clear 429", async () => {
    const client = as(buildApp(), "u1", "o1");
    for (let i = 0; i < 10; i += 1) {
      expect((await client.generate()).status).toBe(200);
    }
    const res = await client.generate();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMIT_ERROR");
    expect(res.body.error.message).toMatch(/10 per hour per user/);
    expect(res.body.error.message).toMatch(/Try again in about \d+ minutes?/);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("reads the per-user limit from env", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "2";
    const client = as(buildApp(), "u1", "o1");
    expect((await client.generate()).status).toBe(200);
    expect((await client.generate()).status).toBe(200);
    expect((await client.generate()).status).toBe(429);
  });

  it("falls back to the default when the env value is invalid", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "abc";
    const client = as(buildApp(), "u1", "o1");
    for (let i = 0; i < 10; i += 1) {
      expect((await client.generate()).status).toBe(200);
    }
    expect((await client.generate()).status).toBe(429);
  });

  it("budgets users separately", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "1";
    const app = buildApp();
    expect((await as(app, "u1", "o1").generate()).status).toBe(200);
    expect((await as(app, "u1", "o1").generate()).status).toBe(429);
    expect((await as(app, "u2", "o1").generate()).status).toBe(200);
  });

  it("caps an organization across its users", async () => {
    process.env.AI_BUDGET_ORG_PER_HOUR = "3";
    const app = buildApp();
    expect((await as(app, "u1", "o1").generate()).status).toBe(200);
    expect((await as(app, "u2", "o1").generate()).status).toBe(200);
    expect((await as(app, "u3", "o1").generate()).status).toBe(200);
    const res = await as(app, "u4", "o1").generate();
    expect(res.status).toBe(429);
    expect(res.body.error.message).toMatch(/organization has reached.*3 per hour/);
    expect((await as(app, "u5", "o2").generate()).status).toBe(200);
  });

  it("does not spend user budget on a call the organization cap refused", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "2";
    process.env.AI_BUDGET_ORG_PER_HOUR = "2";
    const app = buildApp();
    expect((await as(app, "u1", "o1").generate()).status).toBe(200);
    expect((await as(app, "u2", "o1").generate()).status).toBe(200);
    expect((await as(app, "u1", "o1").generate()).status).toBe(429);
    process.env.AI_BUDGET_ORG_PER_HOUR = "10";
    expect((await as(app, "u1", "o1").generate()).status).toBe(200);
    expect((await as(app, "u1", "o1").generate()).status).toBe(429);
  });

  it("lets calls through again after the hour passes", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "1";
    let now = 1_000_000;
    const client = as(buildApp(() => now), "u1", "o1");
    expect((await client.generate()).status).toBe(200);
    expect((await client.generate()).status).toBe(429);
    now += HOUR_MS - 1;
    expect((await client.generate()).status).toBe(429);
    now += 2;
    expect((await client.generate()).status).toBe(200);
  });

  it("gives the slot back when the request is rejected as a client error", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "1";
    const client = as(buildApp(), "u1", "o1");
    expect((await client.generate({ bad: true })).status).toBe(400);
    expect((await client.generate({ bad: true })).status).toBe(400);
    expect((await client.generate()).status).toBe(200);
    expect((await client.generate()).status).toBe(429);
  });

  it("keeps the slot spent when the AI call fails on the server side", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "1";
    const client = as(buildApp(), "u1", "o1");
    expect((await client.generate({ boom: true })).status).toBe(503);
    expect((await client.generate()).status).toBe(429);
  });

  it("rejects a request that was never authenticated", async () => {
    const res = await request(buildApp()).post("/generate").send({});
    expect(res.status).toBe(401);
  });

  it("does not touch routes that do not use it", async () => {
    process.env.AI_BUDGET_USER_PER_HOUR = "1";
    const app = buildApp();
    await as(app, "u1", "o1").generate();
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get("/mailbox").set("x-user", "u1").set("x-org", "o1");
      expect(res.status).toBe(200);
    }
  });
});

describe("aiRoutes wiring", () => {
  type Layer = { route?: { path: string; stack: { handle: unknown }[] } };
  const router = aiRoutes as unknown as { stack: Layer[] };
  const handlersFor = (path: string) =>
    router.stack.find((layer) => layer.route?.path === path)?.route?.stack.map((l) => l.handle) ?? [];

  it.each(["/process", "/generate-chart"])("budgets %s", (path) => {
    expect(handlersFor(path)).toContain(aiBudget);
  });

  it.each(["/suggest-recipients", "/analyze-topics"])("leaves %s alone", (path) => {
    expect(handlersFor(path).length).toBeGreaterThan(0);
    expect(handlersFor(path)).not.toContain(aiBudget);
  });
});
