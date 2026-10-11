import request from "supertest";
import { makeQuery, makeSupabaseMock } from "./mocks/supabase";
import { signAppToken } from "../utils/jwt";

jest.mock("../utils/supabaseClient", () => ({
  supabase: require("./mocks/supabase").makeSupabaseMock(),
}));

import { supabase } from "../utils/supabaseClient";
import { app } from "../app";

const mockedSupabase = supabase as unknown as ReturnType<typeof makeSupabaseMock>;

const token = () => signAppToken("user-1", "org-1");
const staffLookup = () => makeQuery({ data: { role: "STAFF", staffRole: "IT" }, error: null });
const clientLookup = () => makeQuery({ data: { role: "CLIENT", staffRole: null }, error: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockedSupabase.from.mockReset();
});

describe("GET /api/requirements/projects/summary", () => {
  const projectRows = [
    {
      id: "p1",
      organizationId: "org-1",
      clientUserId: "c1",
      name: "Website",
      description: "Marketing site",
      repositoryUrl: null,
      applicationUrl: null,
      status: "ACTIVE",
      createdAt: "2026-10-02T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
      client: { name: "Acme Corp" },
      requirements: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
      modifications: [
        { id: "m1", status: "PENDING_REVIEW" },
        { id: "m2", status: "ACCEPTED" },
        { id: "m3", status: "PENDING_REVIEW" },
      ],
    },
    {
      id: "p2",
      organizationId: "org-1",
      clientUserId: "c2",
      name: "Mobile app",
      description: null,
      repositoryUrl: null,
      applicationUrl: null,
      status: "ACTIVE",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      client: null,
      requirements: [],
      modifications: null,
    },
  ];

  it("returns each project with clientName and counts, from a single Project query", async () => {
    const projectQuery = makeQuery({ data: projectRows, error: null });
    mockedSupabase.from
      .mockReturnValueOnce(staffLookup()) // requireStaff role lookup
      .mockReturnValueOnce(projectQuery); // the one and only Project query

    const res = await request(app)
      .get("/api/requirements/projects/summary")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    expect(res.body[0]).toMatchObject({
      id: "p1",
      name: "Website",
      description: "Marketing site",
      status: "ACTIVE",
      clientName: "Acme Corp",
      requirementCount: 3,
      pendingModificationCount: 2,
    });
    expect(res.body[1]).toMatchObject({
      id: "p2",
      clientName: null,
      requirementCount: 0,
      pendingModificationCount: 0,
    });

    // Embedded arrays are reduced to counts, not leaked into the response.
    for (const project of res.body) {
      expect(project).not.toHaveProperty("client");
      expect(project).not.toHaveProperty("requirements");
      expect(project).not.toHaveProperty("modifications");
    }

    // No N+1: role lookup + one Project query, regardless of project count.
    expect(mockedSupabase.from).toHaveBeenCalledTimes(2);
    expect(mockedSupabase.from).toHaveBeenNthCalledWith(2, "Project");
  });

  it("scopes to the caller's organization and ACTIVE projects only", async () => {
    const projectQuery = makeQuery({ data: [], error: null });
    mockedSupabase.from
      .mockReturnValueOnce(staffLookup())
      .mockReturnValueOnce(projectQuery);

    await request(app)
      .get("/api/requirements/projects/summary")
      .set("Authorization", `Bearer ${token()}`);

    expect(projectQuery.eq).toHaveBeenCalledWith("organizationId", "org-1");
    expect(projectQuery.eq).toHaveBeenCalledWith("status", "ACTIVE");
  });

  it("returns 500 when the query fails", async () => {
    mockedSupabase.from
      .mockReturnValueOnce(staffLookup())
      .mockReturnValueOnce(makeQuery({ data: null, error: { message: "relationship not found" } }));

    const res = await request(app)
      .get("/api/requirements/projects/summary")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(500);
  });

  it("rejects CLIENT users with 403", async () => {
    mockedSupabase.from.mockReturnValueOnce(clientLookup());

    const res = await request(app)
      .get("/api/requirements/projects/summary")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(403);
    expect(mockedSupabase.from).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/requirements/clients", () => {
  it("returns the CLIENT users in the caller's organization", async () => {
    const clients = [
      { id: "c1", name: "Acme Corp", email: "ops@acme.test" },
      { id: "c2", name: "Globex", email: "it@globex.test" },
    ];
    const clientsQuery = makeQuery({ data: clients, error: null });
    mockedSupabase.from
      .mockReturnValueOnce(staffLookup())
      .mockReturnValueOnce(clientsQuery);

    const res = await request(app)
      .get("/api/requirements/clients")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(clients);
    expect(mockedSupabase.from).toHaveBeenNthCalledWith(2, "User");
    expect(clientsQuery.select).toHaveBeenCalledWith("id, name, email");
    expect(clientsQuery.eq).toHaveBeenCalledWith("organizationId", "org-1");
    expect(clientsQuery.eq).toHaveBeenCalledWith("role", "CLIENT");
  });

  it("rejects CLIENT users with 403", async () => {
    mockedSupabase.from.mockReturnValueOnce(clientLookup());

    const res = await request(app)
      .get("/api/requirements/clients")
      .set("Authorization", `Bearer ${token()}`);

    expect(res.status).toBe(403);
  });
});

describe("POST /api/requirements/projects", () => {
  it("creates new projects as ACTIVE", async () => {
    const insertQuery = makeQuery({ data: { id: "p9", status: "ACTIVE" }, error: null });
    mockedSupabase.from
      .mockReturnValueOnce(staffLookup()) // role lookup
      .mockReturnValueOnce(makeQuery({ data: { id: "11111111-1111-4111-8111-111111111111", role: "CLIENT" }, error: null })) // client check
      .mockReturnValueOnce(insertQuery); // Project insert

    const res = await request(app)
      .post("/api/requirements/projects")
      .set("Authorization", `Bearer ${token()}`)
      .send({ clientUserId: "11111111-1111-4111-8111-111111111111", name: "New project" });

    expect(res.status).toBe(201);
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New project", status: "ACTIVE" })
    );
  });
});
