import { makeQuery, makeSupabaseMock } from "./mocks/supabase";

jest.mock("../utils/supabaseClient", () => ({
  supabase: require("./mocks/supabase").makeSupabaseMock(),
}));

import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { isCompanyAddress } from "../services/companyMail";
import { assertCompanyRecipients } from "../services/mailDeliveryService";
import { getThread } from "../controllers/emailController";

const mockedSupabase = supabase as unknown as ReturnType<typeof makeSupabaseMock>;

const orgOne = [
  { id: "user-1", email: "sender@raidtechs.com", name: "Sender", organizationId: "org-1" },
  { id: "user-2", email: "Hadi@RaidTechs.com", name: "Hadi", organizationId: "org-1" },
];

async function failure(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the promise to reject");
}

beforeEach(() => {
  mockedSupabase.from.mockReset();
});

describe("isCompanyAddress", () => {
  it("matches the domain case-insensitively and nothing sneakier", () => {
    expect(isCompanyAddress("A@RAIDTECHS.COM")).toBe(true);
    expect(isCompanyAddress("a@raidtechs.com.evil.com")).toBe(false);
    expect(isCompanyAddress("a@evil.com@raidtechs.com")).toBe(false);
    expect(isCompanyAddress("@raidtechs.com")).toBe(false);
    expect(isCompanyAddress(null)).toBe(false);
  });
});

describe("assertCompanyRecipients", () => {
  it("accepts a same-organization @raidtechs.com user, ignoring case", async () => {
    const users = makeQuery({ data: orgOne, error: null });
    mockedSupabase.from.mockReturnValueOnce(users);

    await expect(
      assertCompanyRecipients("org-1", ["hadi@raidtechs.com", " SENDER@RAIDTECHS.COM "])
    ).resolves.toBeUndefined();
    expect(mockedSupabase.from).toHaveBeenCalledWith("User");
    expect(users.eq).toHaveBeenCalledWith("organizationId", "org-1");
  });

  it("rejects gmail.com by name without querying the database", async () => {
    const err = await failure(assertCompanyRecipients("org-1", ["hadi@raidtechs.com", "someone@gmail.com"]));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode ?? err.status).toBe(400);
    expect(err.message).toContain("someone@gmail.com");
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it("rejects an unknown @raidtechs.com address", async () => {
    mockedSupabase.from.mockReturnValueOnce(makeQuery({ data: orgOne, error: null }));

    const err = await failure(assertCompanyRecipients("org-1", ["hadi@raidtechs.com", "ghost@raidtechs.com"]));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode ?? err.status).toBe(400);
    expect(err.message).toContain("ghost@raidtechs.com");
  });

  it("rejects a user who belongs to another organization", async () => {
    // olivia exists, but in org-2, so the org-1 lookup does not return her.
    const users = makeQuery({ data: orgOne, error: null });
    mockedSupabase.from.mockReturnValueOnce(users);

    const err = await failure(assertCompanyRecipients("org-1", ["olivia@raidtechs.com"]));

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode ?? err.status).toBe(400);
    expect(err.message).toContain("olivia@raidtechs.com");
    expect(users.eq).toHaveBeenCalledWith("organizationId", "org-1");
  });
});

describe("getThread", () => {
  const req = () =>
    ({ params: { threadId: "thread-1" }, auth: { userId: "user-1", organizationId: "org-1" } }) as any;

  it("only loads emails sent by users of the caller's organization", async () => {
    const people = makeQuery({ data: [{ id: "user-1" }, { id: "user-2" }], error: null });
    const emails = makeQuery({ data: [], error: null });
    mockedSupabase.from.mockReturnValueOnce(people).mockReturnValueOnce(emails);
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    await getThread(req(), res, next);

    expect(mockedSupabase.from).toHaveBeenNthCalledWith(1, "User");
    expect(people.eq).toHaveBeenCalledWith("organizationId", "org-1");
    expect(mockedSupabase.from).toHaveBeenNthCalledWith(2, "Email");
    expect(emails.eq).toHaveBeenCalledWith("threadId", "thread-1");
    expect(emails.in).toHaveBeenCalledWith("senderId", ["user-1", "user-2"]);
    expect(res.json).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe("Thread not found");
  });

  it("does not return another organization's rows even if one slips through the query", async () => {
    const people = makeQuery({ data: [{ id: "user-1" }], error: null });
    const emails = makeQuery({ data: [{ id: "email-9", senderId: "user-9" }], error: null });
    const emailById = makeQuery({ data: { id: "email-9", senderId: "user-9", recipients: [] }, error: null });
    const sender = makeQuery({
      data: { id: "user-9", email: "olivia@raidtechs.com", name: "Olivia", organizationId: "org-2" },
      error: null,
    });
    mockedSupabase.from
      .mockReturnValueOnce(people)
      .mockReturnValueOnce(emails)
      .mockReturnValueOnce(emailById)
      .mockReturnValueOnce(sender);
    const res = { json: jest.fn() } as any;
    const next = jest.fn();

    await getThread(req(), res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe("Thread not found");
  });
});
