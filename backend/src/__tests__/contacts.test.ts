import request from "supertest";
import { makeQuery, makeSupabaseMock } from "./mocks/supabase";
import { signAppToken } from "../utils/jwt";

jest.mock("../utils/supabaseClient", () => ({
  supabase: require("./mocks/supabase").makeSupabaseMock(),
}));

import { supabase } from "../utils/supabaseClient";
import { app } from "../app";

const mockedSupabase = supabase as unknown as ReturnType<typeof makeSupabaseMock>;
const token = signAppToken("user-1", "org-1");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/contacts", () => {
  it("lists the caller's contacts", async () => {
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({ data: [{ id: "c1", name: "Sam", email: "sam@example.com" }], error: null })
    );

    const res = await request(app).get("/api/contacts").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("POST /api/contacts", () => {
  it("creates a contact", async () => {
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({ data: { id: "c1", name: "Sam", email: "sam@example.com" }, error: null })
    );

    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sam", email: "sam@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("sam@example.com");
  });

  it("rejects an invalid email", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sam", email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/contacts/:id", () => {
  it("deletes a contact", async () => {
    mockedSupabase.from.mockReturnValueOnce(makeQuery({ data: null, error: null }));

    const res = await request(app)
      .delete("/api/contacts/c1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
