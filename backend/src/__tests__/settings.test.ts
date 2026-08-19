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

describe("GET /api/users/settings", () => {
  it("returns sensible defaults when no row exists yet", async () => {
    mockedSupabase.from.mockReturnValueOnce(makeQuery({ data: null, error: null }));

    const res = await request(app)
      .get("/api/users/settings")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      aiTone: "professional",
      defaultChartType: "bar",
      themePreference: "light",
    });
  });

  it("returns the stored row when one exists", async () => {
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({
        data: { userId: "user-1", aiTone: "casual", defaultChartType: "pie", themePreference: "dark" },
        error: null,
      })
    );

    const res = await request(app)
      .get("/api/users/settings")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.aiTone).toBe("casual");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/users/settings");
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/users/settings", () => {
  it("upserts and returns the updated row", async () => {
    mockedSupabase.from.mockReturnValueOnce(
      makeQuery({
        data: { userId: "user-1", aiTone: "urgent", defaultChartType: "bar", themePreference: "light" },
        error: null,
      })
    );

    const res = await request(app)
      .put("/api/users/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ aiTone: "urgent" });

    expect(res.status).toBe(200);
    expect(res.body.aiTone).toBe("urgent");
  });

  it("rejects an invalid aiTone value", async () => {
    const res = await request(app)
      .put("/api/users/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ aiTone: "furious" });

    expect(res.status).toBe(400);
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});
