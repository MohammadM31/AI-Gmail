import request from "supertest";
import { makeSupabaseMock } from "./mocks/supabase";
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

describe("POST /api/emails/attachments/upload-url", () => {
  it("returns a signed upload URL namespaced by organization and user", async () => {
    (mockedSupabase.storage.from as jest.Mock).mockReturnValueOnce({
      createSignedUploadUrl: jest
        .fn()
        .mockResolvedValue({ data: { token: "upload-token", signedUrl: "https://storage/upload" }, error: null }),
    });

    const res = await request(app)
      .post("/api/emails/attachments/upload-url")
      .set("Authorization", `Bearer ${token}`)
      .send({ fileName: "report.pdf" });

    expect(res.status).toBe(200);
    expect(res.body.signedUrl).toBe("https://storage/upload");
    expect(res.body.path.startsWith("org-1/user-1/")).toBe(true);
    expect(res.body.path.endsWith("report.pdf")).toBe(true);
  });

  it("requires a fileName", async () => {
    const res = await request(app)
      .post("/api/emails/attachments/upload-url")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("GET /api/emails/attachments/signed-url", () => {
  it("returns a signed download URL for a path under the caller's own org", async () => {
    (mockedSupabase.storage.from as jest.Mock).mockReturnValueOnce({
      createSignedUrl: jest
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://storage/download" }, error: null }),
    });

    const res = await request(app)
      .get("/api/emails/attachments/signed-url")
      .query({ path: "org-1/user-1/123-report.pdf" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://storage/download");
  });

  it("refuses a path under a different organization", async () => {
    const res = await request(app)
      .get("/api/emails/attachments/signed-url")
      .query({ path: "org-2/someone-else/123-secret.pdf" })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(mockedSupabase.storage.from).not.toHaveBeenCalled();
  });
});
