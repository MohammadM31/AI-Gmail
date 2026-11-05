import request from "supertest";
import { app } from "../app";
import { signAppToken } from "../utils/jwt";

describe("auth and AI exposure", () => {
  const previousEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
  });

  it.each(["production", "development"])(
    "rejects dev-token when NODE_ENV is %s",
    async (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;
      const res = await request(app)
        .get("/api/emails")
        .set("Authorization", "Bearer dev-token");

      expect(res.status).toBe(401);
    }
  );

  it("does not expose an unauthenticated AI test route", async () => {
    const anonymous = await request(app)
      .post("/api/ai/test")
      .send({ message: "hello" });
    expect(anonymous.status).toBe(401);

    const token = signAppToken("user-1", "org-1");
    const authed = await request(app)
      .post("/api/ai/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "hello" });
    expect(authed.status).toBe(404);
  });
});
