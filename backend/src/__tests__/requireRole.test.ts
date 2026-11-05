import type { NextFunction, Request, Response } from "express";
import { makeQuery, makeSupabaseMock } from "./mocks/supabase";

jest.mock("../utils/supabaseClient", () => ({
  supabase: require("./mocks/supabase").makeSupabaseMock(),
}));

import { supabase } from "../utils/supabaseClient";
import { requireClient, requireRole, requireStaff } from "../middleware/requireRole";

const mockedSupabase = supabase as unknown as ReturnType<typeof makeSupabaseMock>;

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;

// Runs a middleware and resolves with whatever it passed to next()
// (undefined = allowed, otherwise the error).
function run(middleware: Middleware, req: Partial<Request>): Promise<{ status?: number } | undefined> {
  return new Promise((resolve) => {
    middleware(req as Request, {} as Response, (err?: unknown) =>
      resolve(err as { status?: number } | undefined)
    );
  });
}

const authedReq = (): Partial<Request> => ({ auth: { userId: "u1", organizationId: "o1" } });

function mockUser(data: { role: string; staffRole: string | null } | null, error: { message: string } | null = null) {
  mockedSupabase.from.mockReturnValue(makeQuery({ data, error }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSupabase.from.mockReset();
});

describe("requireStaff", () => {
  it("allows STAFF", async () => {
    mockUser({ role: "STAFF", staffRole: "IT" });
    expect(await run(requireStaff, authedReq())).toBeUndefined();
  });

  it("allows STAFF with no staffRole", async () => {
    mockUser({ role: "STAFF", staffRole: null });
    expect(await run(requireStaff, authedReq())).toBeUndefined();
  });

  it("rejects CLIENT with 403", async () => {
    mockUser({ role: "CLIENT", staffRole: null });
    expect((await run(requireStaff, authedReq()))?.status).toBe(403);
  });

  it("rejects with 403 when the user row is missing or the lookup errors", async () => {
    mockUser(null, { message: "not found" });
    expect((await run(requireStaff, authedReq()))?.status).toBe(403);
  });

  it("rejects with 403 on an unrecognised role value", async () => {
    mockUser({ role: "ROOT", staffRole: null });
    expect((await run(requireStaff, authedReq()))?.status).toBe(403);
  });

  it("rejects with 401 and skips the DB when unauthenticated", async () => {
    expect((await run(requireStaff, {}))?.status).toBe(401);
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  const anyStaff = requireRole(["IT", "ADMIN", "SUPER_ADMIN"]);
  const adminOnly = requireRole(["ADMIN", "SUPER_ADMIN"]);

  it("allows a staffRole in the list", async () => {
    mockUser({ role: "STAFF", staffRole: "ADMIN" });
    expect(await run(adminOnly, authedReq())).toBeUndefined();
  });

  it("rejects a staffRole not in the list", async () => {
    mockUser({ role: "STAFF", staffRole: "IT" });
    expect((await run(adminOnly, authedReq()))?.status).toBe(403);
  });

  it("rejects STAFF with no staffRole", async () => {
    mockUser({ role: "STAFF", staffRole: null });
    expect((await run(anyStaff, authedReq()))?.status).toBe(403);
  });

  it("rejects CLIENT even when every staffRole is allowed", async () => {
    mockUser({ role: "CLIENT", staffRole: null });
    expect((await run(anyStaff, authedReq()))?.status).toBe(403);
  });
});

describe("requireClient", () => {
  it("allows CLIENT and rejects STAFF", async () => {
    mockUser({ role: "CLIENT", staffRole: null });
    expect(await run(requireClient, authedReq())).toBeUndefined();

    mockUser({ role: "STAFF", staffRole: "ADMIN" });
    expect((await run(requireClient, authedReq()))?.status).toBe(403);
  });
});

describe("role lookup caching", () => {
  it("hits the User table once per request across several role middlewares", async () => {
    mockUser({ role: "STAFF", staffRole: "ADMIN" });
    const req = authedReq();

    expect(await run(requireStaff, req)).toBeUndefined();
    expect(await run(requireRole(["ADMIN"]), req)).toBeUndefined();
    expect((await run(requireClient, req))?.status).toBe(403);

    expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
  });
});
