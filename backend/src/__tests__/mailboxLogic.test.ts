import {
  applyRules,
  factsFromText,
  inFolder,
  matchesSearch,
  parseSearch,
  quotedBullets,
  scheduleDecision,
  withSignature,
  type MailRow,
} from "../services/mailboxLogic";

const row = (patch: Partial<MailRow> = {}): MailRow => ({
  id: "e1",
  senderId: "staff",
  status: "sent",
  recipients: [{ name: "Client", email: "client@example.com" }],
  subject: "Prototype next week",
  bulletPoints: ["Prototype review on Nov 16"],
  attachments: [],
  createdAt: "2026-11-04T10:00:00.000Z",
  ...patch,
});

describe("mailbox folders", () => {
  it("shows a received message in the inbox and not in later folders", () => {
    const message = row();
    expect(inFolder(message, "client@example.com", "client", undefined, "inbox")).toBe(true);
    expect(inFolder(message, "client@example.com", "client", undefined, "sent")).toBe(false);
    expect(inFolder(message, "client@example.com", "client", { folder: "spam" }, "inbox")).toBe(false);
    expect(inFolder(message, "client@example.com", "client", { folder: "spam" }, "spam")).toBe(true);
  });

  it("keeps the sender copy in sent and a trashed row restorable", () => {
    expect(inFolder(row(), "staff@example.com", "staff", undefined, "sent")).toBe(true);
    expect(inFolder(row({ status: "draft" }), "staff@example.com", "staff", undefined, "drafts")).toBe(true);
    expect(
      inFolder(row({ deletedAt: "2026-11-04T12:00:00.000Z" }), "staff@example.com", "staff", undefined, "trash")
    ).toBe(true);
    expect(
      inFolder(row({ status: "pending" }), "staff@example.com", "staff", undefined, "scheduled")
    ).toBe(true);
  });

  it("does not treat an inbound copy as sent mail", () => {
    const inbound = row({ senderId: "client", status: "sent" });
    expect(inFolder(inbound, "client@example.com", "client", { direction: "in" }, "inbox")).toBe(true);
    expect(inFolder(inbound, "client@example.com", "client", { direction: "in" }, "sent")).toBe(false);
  });
});

describe("search and rules", () => {
  it("parses operators and leaves the free text", () => {
    const parsed = parseSearch('from:hadi has:attachment after:2026-11-01 prototype');
    expect(parsed.from).toBe("hadi");
    expect(parsed.hasAttachment).toBe(true);
    expect(parsed.after).toBe("2026-11-01");
    expect(parsed.text).toBe("prototype");
  });

  it("matches a starred attachment search against the row", () => {
    const parsed = parseSearch("is:starred has:attachment prototype");
    const message = row({ attachments: [{ name: "fig.png" }] });
    expect(matchesSearch(message, { starred: true, from: { name: "Hadi", email: "hadi@example.com" } }, parsed, true)).toBe(true);
    expect(matchesSearch(message, { starred: false }, parsed, true)).toBe(false);
  });

  it("moves matching mail and keeps the quoted history short", () => {
    const patch = applyRules(
      [{ id: "r1", from: "hadi", folder: "archive", label: "design", star: true }],
      { from: "Hadi <hadi@example.com>", subject: "Prototype", hasAttachment: false }
    );
    expect(patch.folder).toBe("archive");
    expect(patch.labels).toEqual(["design"]);
    expect(patch.starred).toBe(true);
    expect(quotedBullets("Plan", ["one", "two", "three"], 2)).toEqual([
      "Earlier (Plan): one",
      "Earlier (Plan): two",
    ]);
  });
});

describe("send timing and facts", () => {
  it("holds a send for undo unless a later time was chosen", () => {
    const now = Date.parse("2026-11-04T10:00:00.000Z");
    expect(scheduleDecision(now, undefined).status).toBe("pending");
    expect(scheduleDecision(now, "2026-11-05T10:00:00.000Z").status).toBe("scheduled");
  });

  it("turns a note into short facts and appends a signature once", () => {
    expect(factsFromText("Meeting at 7pm.\nBoss is joining.")).toEqual([
      "Meeting at 7pm.",
      "Boss is joining.",
    ]);
    expect(withSignature(["Prototype Friday"], ["Prototype Friday", "Sent from the studio"])).toEqual([
      "Prototype Friday",
      "Sent from the studio",
    ]);
  });
});
