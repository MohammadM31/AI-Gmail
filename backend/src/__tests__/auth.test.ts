import request from "supertest";
import { makeQuery, makeSupabaseMock } from "./mocks/supabase";
import { signAppToken } from "../utils/jwt";

jest.mock("../utils/supabaseClient", () => ({
  supabase: require("./mocks/supabase").makeSupabaseMock(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { supabase } from "../utils/supabaseClient";
import { app } from "../app";

const mockedSupabase = supabase as unknown as ReturnType<typeof makeSupabaseMock>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("creates a new organization when organizationName is given", async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockedSupabase.from
      .mockReturnValueOnce(
        makeQuery({ data: { id: "org-1", name: "Acme", inviteCode: "abc123" }, error: null })
      ) // Organization insert
      .mockReturnValueOnce(makeQuery({ data: null, error: null })); // User insert

    const res = await request(app).post("/api/auth/register").send({
      email: "a@example.com",
      password: "password123",
      name: "Ada",
      organizationName: "Acme",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      id: "user-1",
      email: "a@example.com",
      organizationId: "org-1",
    });
    expect(typeof res.body.token).toBe("string");
  });

  it("joins an existing organization when a valid inviteCode is given", async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    mockedSupabase.from
      .mockReturnValueOnce(makeQuery({ data: { id: "org-1" }, error: null })) // Organization lookup
      .mockReturnValueOnce(makeQuery({ data: null, error: null })); // User insert

    const res = await request(app).post("/api/auth/register").send({
      email: "b@example.com",
      password: "password123",
      name: "Bea",
      inviteCode: "abc123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.organizationId).toBe("org-1");
  });

  it("rejects an invalid invite code", async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-3" } },
      error: null,
    });
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({ data: null, error: { message: "not found" } })
    );

    const res = await request(app).post("/api/auth/register").send({
      email: "c@example.com",
      password: "password123",
      name: "Cy",
      inviteCode: "bogus",
    });

    expect(res.status).toBe(400);
  });

  it("rejects when neither organizationName nor inviteCode is given", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "d@example.com",
      password: "password123",
      name: "Dee",
    });

    expect(res.status).toBe(400);
    expect(mockedSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects when both organizationName and inviteCode are given", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "e@example.com",
      password: "password123",
      name: "Eli",
      organizationName: "Acme",
      inviteCode: "abc123",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a user and app-minted token on success", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "supabase-token" }, user: { id: "user-1" } },
      error: null,
    });
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({
        data: { id: "user-1", email: "a@example.com", name: "Ada", organizationId: "org-1" },
        error: null,
      })
    );

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.user.organizationId).toBe("org-1");
    // Should NOT just forward Supabase's own session token — see utils/jwt.ts.
    expect(res.body.token).not.toBe("supabase-token");
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects invalid credentials", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "wrong" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the user for a token minted at login", async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "x" }, user: { id: "user-1" } },
      error: null,
    });
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({
        data: { id: "user-1", email: "a@example.com", name: "Ada", organizationId: "org-1" },
        error: null,
      })
    );
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "password123" });
    const token = loginRes.body.token;

    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({
        data: { id: "user-1", email: "a@example.com", name: "Ada", organizationId: "org-1" },
        error: null,
      })
    );
    const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe("user-1");
  });
});

describe("GET /api/auth/org/invite-code", () => {
  it("returns the organization's invite code for an authenticated member", async () => {
    const token = signAppToken("user-1", "org-1");
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({ data: { id: "org-1", name: "Acme", inviteCode: "abc123" }, error: null })
    );

    const res = await request(app)
      .get("/api/auth/org/invite-code")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ organizationName: "Acme", inviteCode: "abc123" });
  });
});

describe("POST /api/auth/org/invite-code/regenerate", () => {
  it("rotates and returns a new invite code", async () => {
    const token = signAppToken("user-1", "org-1");
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({ data: { id: "org-1", name: "Acme", inviteCode: "new-code" }, error: null })
    );

    const res = await request(app)
      .post("/api/auth/org/invite-code/regenerate")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.inviteCode).toBe("new-code");
  });
});
