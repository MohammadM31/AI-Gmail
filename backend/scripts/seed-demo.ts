import "dotenv/config";
import { randomUUID } from "crypto";
import { supabase } from "../src/utils/supabaseClient";
import { createEmail } from "../src/services/emailProcessor";
import { loadMailbox, saveMailbox } from "../src/services/mailboxStore";
import type { EmailMeta } from "../src/services/mailboxLogic";

const ADMIN_EMAIL = "demo-admin@example.com";
const DEMO_CLIENT_EMAIL = "demo-client@example.com";
const NEW_CLIENT_PASSWORD = "Client1234";
const PROJECT_NAMES = ["Client Portal", "Billing Dashboard", "Field Reports", "Onboarding Kit"] as const;

// Pipeline is unique on (userId, contactId), and Contact email is unique per user.
// Billing Dashboard needs its own contact so it can have its own pipeline.
// Mail for that project still goes to lina.client@raidtechs.com.
const LINA_BILLING_CONTACT = "lina.haddad@raidtechs.com";

type StageStatus = "complete" | "in-progress" | "pending";
type ChartType = "bar" | "line" | "pie";

interface Person {
  id: string;
  email: string;
  name: string;
}

interface ChartPlan {
  type: ChartType;
  title: string;
  labels: string[];
  values: number[];
  enabled: true;
}

interface MailPlan {
  from: "admin" | "client";
  subject: string;
  bullets: string[];
  at: string;
  sentAt?: string;
  status?: "sent" | "scheduled";
  chart?: ChartPlan;
  star?: boolean;
}

interface StagePlan {
  name: string;
  description: string;
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  dueDate: string | null;
  duration: number;
  emailIndexes: number[];
}

interface ProjectPlan {
  name: (typeof PROJECT_NAMES)[number];
  client: "lina" | "omar" | "demo";
  contactEmail: string;
  contactName: string;
  description: string;
  repositoryUrl: string;
  applicationUrl: string;
  createdAt: string;
  tasks: { title: string; emailIndex: number; stageIndex: number }[];
  mails: MailPlan[];
  stages: StagePlan[];
}

function stamp(value: string): string {
  return new Date(value).toISOString();
}

function companyContact(email: string, demoClientEmail: string): boolean {
  const value = email.trim().toLowerCase();
  if (value === demoClientEmail.trim().toLowerCase()) return true;
  const domain = "@raidtechs.com";
  return value.length > domain.length && value.endsWith(domain) && value.indexOf("@") === value.length - domain.length;
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`;
  return /does not exist|schema cache|Could not find|PGRST205|42P01/i.test(message);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

async function findAuthUserId(email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureClient(organizationId: string, email: string, name: string): Promise<Person> {
  const existing = await supabase
    .from("User")
    .select("id, email, name, organizationId, role")
    .eq("email", email)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if (existing.data.organizationId !== organizationId) {
      throw new Error(`${email} is already registered outside this organization`);
    }
    return { id: existing.data.id, email: existing.data.email, name: existing.data.name };
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password: NEW_CLIENT_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  const userId = created.data.user?.id ?? (await findAuthUserId(email));
  if (!userId) throw new Error(created.error?.message ?? `Could not create ${email}`);

  const row = await supabase.from("User").select("id, email, name, organizationId").eq("id", userId).maybeSingle();
  if (row.error) throw new Error(row.error.message);
  if (row.data) {
    if (row.data.organizationId !== organizationId) {
      throw new Error(`${email} is already registered outside this organization`);
    }
    return { id: row.data.id, email: row.data.email, name: row.data.name };
  }

  const inserted = await supabase.from("User").insert({
    id: userId,
    email,
    name,
    organizationId,
    role: "CLIENT",
    staffRole: null,
  });
  if (inserted.error) throw new Error(inserted.error.message);
  return { id: userId, email, name };
}

async function ensureContact(userId: string, name: string, email: string): Promise<string> {
  const existing = await supabase.from("Contact").select("id").eq("userId", userId).eq("email", email).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id;
  const inserted = await supabase.from("Contact").insert({ userId, name, email }).select("id").single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Could not save a contact");
  return inserted.data.id;
}

async function idsForPrefix(senderIds: string[], prefix: string): Promise<string[]> {
  if (senderIds.length === 0) return [];
  const { data, error } = await supabase.from("Email").select("id").in("senderId", senderIds).like("subject", `${prefix}%`);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function deleteSeedMail(senderIds: string[]): Promise<string[]> {
  const ids = [...new Set([...(await idsForPrefix(senderIds, "History:")), ...(await idsForPrefix(senderIds, "Sample:"))])];
  for (const id of ids) {
    const retarget = await supabase.from("Email").update({ threadId: id }).eq("id", id);
    if (retarget.error) throw new Error(retarget.error.message);
  }
  if (ids.length > 0) {
    const removed = await supabase.from("Email").delete().in("id", ids);
    if (removed.error) throw new Error(removed.error.message);
  }
  return ids;
}

async function writeMailboxes(
  organizationId: string,
  userIds: string[],
  drop: string[],
  flags: Map<string, Record<string, EmailMeta>>
): Promise<void> {
  for (const userId of userIds) {
    const added = flags.get(userId);
    if (!added && drop.length === 0) continue;
    const mailbox = await loadMailbox(organizationId, userId);
    for (const id of drop) delete mailbox.emails[id];
    for (const [id, meta] of Object.entries(added ?? {})) mailbox.emails[id] = meta;
    await saveMailbox(organizationId, userId, mailbox);
  }
}

async function sendThread(
  admin: Person,
  client: Person,
  mails: MailPlan[],
  flags: Map<string, Record<string, EmailMeta>>
): Promise<string[]> {
  const ids: string[] = [];
  let threadId: string | undefined;
  for (const mail of mails) {
    if (mail.bullets.length < 3 || mail.bullets.length > 5) {
      throw new Error(`Each history email needs 3 to 5 facts: ${mail.subject}`);
    }
    const from = mail.from === "admin" ? admin : client;
    const to = mail.from === "admin" ? client : admin;
    const createdAt = stamp(mail.at);
    const sentAt = stamp(mail.sentAt ?? mail.at);
    const status = mail.status ?? "sent";
    let rowId = "";
    try {
      const row = await createEmail({
        senderId: from.id,
        recipients: [{ name: to.name, email: to.email, role: "to" }],
        subject: `History: ${mail.subject}`,
        content: mail.bullets.join("\n"),
        bulletPoints: mail.bullets,
        chartData: mail.chart,
        threadId,
        status,
        sentAt,
      });
      rowId = row.id as string;
    } catch (error) {
      throw new Error(errorMessage(error, "Could not create email"));
    }
    const dated = await supabase.from("Email").update({ createdAt, sentAt }).eq("id", rowId);
    if (dated.error) throw new Error(dated.error.message);
    if (!threadId) threadId = rowId;
    ids.push(rowId);

    const senderMeta = {
      folder: status === "scheduled" ? "scheduled" : "sent",
      direction: "out",
      unread: false,
      starred: Boolean(mail.star),
      ...(status === "scheduled" ? { scheduledFor: sentAt } : {}),
    } as EmailMeta;
    const senderFlags = flags.get(from.id) ?? {};
    senderFlags[rowId] = senderMeta;
    flags.set(from.id, senderFlags);

    if (status === "sent") {
      const recipientFlags = flags.get(to.id) ?? {};
      recipientFlags[rowId] = {
        folder: "inbox",
        direction: "in",
        unread: true,
        starred: Boolean(mail.star),
        from: { name: from.name, email: from.email },
      };
      flags.set(to.id, recipientFlags);
    }
  }
  return ids;
}

function stageRow(plan: StagePlan, emailIds: string[]) {
  return {
    id: randomUUID(),
    name: plan.name,
    description: plan.description,
    status: plan.status,
    order: 0,
    startedAt: plan.startedAt ? stamp(plan.startedAt) : null,
    completedAt: plan.completedAt ? stamp(plan.completedAt) : null,
    dueDate: plan.dueDate ? stamp(plan.dueDate) : null,
    duration: plan.duration,
    emailIds: plan.emailIndexes.map((index) => emailIds[index]).filter((id): id is string => Boolean(id)),
  };
}

const PROJECTS: ProjectPlan[] = [
  {
    name: "Client Portal",
    client: "lina",
    contactEmail: "lina.client@raidtechs.com",
    contactName: "Lina Haddad",
    description: [
      "Client Portal is the site clients use to follow their work.",
      "Client Portal kickoff was on 12 August 2026.",
      "Client Portal completion is 90% on 3 November 2026.",
      "Launch is in progress, with go-live on 20 November 2026.",
    ].join("\n"),
    repositoryUrl: "https://raidtechs.com/code/client-portal",
    applicationUrl: "https://raidtechs.com/apps/client-portal",
    createdAt: "2026-08-12T09:00:00+02:00",
    tasks: [{ title: "Review the prototype", emailIndex: 4, stageIndex: 2 }],
    mails: [
      {
        from: "client",
        subject: "Client Portal kickoff",
        at: "2026-08-12T09:00:00+02:00",
        bullets: [
          "Client Portal kickoff was on 12 August 2026 at 9:00am",
          "Lina Haddad asked for a client login and a status page",
          "Invoice links are in scope",
          "The first review target is the last week of September 2026",
        ],
      },
      {
        from: "admin",
        subject: "Client Portal scope",
        at: "2026-08-18T11:00:00+02:00",
        bullets: [
          "Client Portal scope is login, project status, and invoice links",
          "Discussion closed on 18 August 2026",
          "Prototype starts on 25 August 2026",
          "No mail outside the company is in scope",
        ],
      },
      {
        from: "client",
        subject: "Client Portal prototype notes",
        at: "2026-09-09T15:30:00+02:00",
        bullets: [
          "Client Portal prototype shows three sample projects",
          "Login works for the client account",
          "The status page is missing the October milestone",
          "Lina Haddad asked for a completion chart",
        ],
      },
      {
        from: "admin",
        subject: "Client Portal prototype ready",
        at: "2026-09-24T10:00:00+02:00",
        bullets: [
          "Client Portal prototype was ready on 24 September 2026",
          "Completion stood at 45% on 24 September 2026",
          "Review is set for 15 October 2026 at 2:00pm",
          "Lina Haddad will bring the open questions",
        ],
      },
      {
        from: "client",
        subject: "Client Portal review",
        at: "2026-10-15T14:00:00+02:00",
        bullets: [
          "Client Portal review ran on 15 October 2026 at 2:00pm",
          "Lina Haddad accepted the status page",
          "Invoice links need one more pass",
          "Launch can start on 21 October 2026",
        ],
      },
      {
        from: "admin",
        subject: "Client Portal launch status",
        at: "2026-11-03T09:15:00+02:00",
        star: true,
        chart: {
          type: "line",
          title: "Client Portal completion",
          labels: ["August", "September", "October", "November"],
          values: [20, 45, 70, 90],
          enabled: true,
        },
        bullets: [
          "Client Portal completion is 90% on 3 November 2026",
          "Completion was 20% in August, 45% in September, 70% in October, and 90% in November",
          "Launch is in progress",
          "Go-live target is 20 November 2026",
        ],
      },
    ],
    stages: [
      {
        name: "Discussion",
        description: "Scope agreed: login, status, and invoice links.",
        status: "complete",
        startedAt: "2026-08-12T09:00:00+02:00",
        completedAt: "2026-08-18T11:00:00+02:00",
        dueDate: "2026-08-18T11:00:00+02:00",
        duration: 6,
        emailIndexes: [0, 1],
      },
      {
        name: "Prototype",
        description: "Prototype ready on 24 September 2026.",
        status: "complete",
        startedAt: "2026-08-25T09:00:00+02:00",
        completedAt: "2026-09-24T10:00:00+02:00",
        dueDate: "2026-09-24T10:00:00+02:00",
        duration: 30,
        emailIndexes: [2, 3],
      },
      {
        name: "Review",
        description: "Review held on 15 October 2026 at 2:00pm.",
        status: "complete",
        startedAt: "2026-10-01T09:00:00+02:00",
        completedAt: "2026-10-15T14:00:00+02:00",
        dueDate: "2026-10-15T14:00:00+02:00",
        duration: 14,
        emailIndexes: [4],
      },
      {
        name: "Launch",
        description: "Launch is in progress. Go-live target is 20 November 2026.",
        status: "in-progress",
        startedAt: "2026-10-21T09:00:00+02:00",
        completedAt: null,
        dueDate: "2026-11-20T17:00:00+02:00",
        duration: 30,
        emailIndexes: [5],
      },
    ],
  },
  {
    name: "Billing Dashboard",
    client: "lina",
    contactEmail: LINA_BILLING_CONTACT,
    contactName: "Lina Haddad",
    description: [
      "Billing Dashboard tracks monthly invoice totals for Lina Haddad.",
      "Billing Dashboard invoices were 4200 in August, 6100 in September, and 5800 in October.",
      "Review is on 10 November 2026 at 7:00pm.",
      "Launch is pending.",
    ].join("\n"),
    repositoryUrl: "https://raidtechs.com/code/billing-dashboard",
    applicationUrl: "https://raidtechs.com/apps/billing-dashboard",
    createdAt: "2026-09-02T10:00:00+02:00",
    tasks: [{ title: "Prepare the invoice", emailIndex: 3, stageIndex: 1 }],
    mails: [
      {
        from: "client",
        subject: "Billing Dashboard kickoff",
        at: "2026-09-02T10:00:00+02:00",
        bullets: [
          "Billing Dashboard kickoff was on 2 September 2026 at 10:00am",
          "Lina Haddad needs invoice totals by month",
          "The board should show paid and open invoices",
          "Discussion closes on 16 September 2026",
        ],
      },
      {
        from: "admin",
        subject: "Billing Dashboard scope",
        at: "2026-09-16T16:00:00+02:00",
        bullets: [
          "Billing Dashboard discussion closed on 16 September 2026",
          "Build starts on 21 September 2026",
          "August invoices totaled 4200",
          "September invoices totaled 6100",
        ],
      },
      {
        from: "client",
        subject: "Billing Dashboard build questions",
        at: "2026-10-07T11:20:00+02:00",
        bullets: [
          "Billing Dashboard build covers August through October",
          "Open invoices are 9 on 7 October 2026",
          "Paid invoices are 28 on 7 October 2026",
          "Totals over 5000 should be flagged",
        ],
      },
      {
        from: "admin",
        subject: "Billing Dashboard totals",
        at: "2026-10-28T13:00:00+02:00",
        star: true,
        chart: {
          type: "bar",
          title: "Billing Dashboard invoices",
          labels: ["August", "September", "October"],
          values: [4200, 6100, 5800],
          enabled: true,
        },
        bullets: [
          "Billing Dashboard invoices were 4200 in August, 6100 in September, and 5800 in October",
          "Build finished on 28 October 2026",
          "6 invoices are still open",
          "Review is the next stage",
        ],
      },
      {
        from: "admin",
        subject: "Billing Dashboard review at 7pm",
        at: "2026-11-05T18:00:00+02:00",
        sentAt: "2026-11-10T19:00:00+02:00",
        status: "scheduled",
        bullets: [
          "Billing Dashboard review is on 10 November 2026 at 7:00pm",
          "Lina Haddad will confirm the 6 open invoices",
          "Launch stays pending until that review",
          "The meeting is 45 minutes",
        ],
      },
    ],
    stages: [
      {
        name: "Discussion",
        description: "Kickoff on 2 September 2026. Scope closed on 16 September 2026.",
        status: "complete",
        startedAt: "2026-09-02T10:00:00+02:00",
        completedAt: "2026-09-16T16:00:00+02:00",
        dueDate: "2026-09-16T16:00:00+02:00",
        duration: 14,
        emailIndexes: [0, 1],
      },
      {
        name: "Build",
        description: "Monthly invoice totals are in. Build finished on 28 October 2026.",
        status: "complete",
        startedAt: "2026-09-21T09:00:00+02:00",
        completedAt: "2026-10-28T13:00:00+02:00",
        dueDate: "2026-10-28T13:00:00+02:00",
        duration: 37,
        emailIndexes: [2, 3],
      },
      {
        name: "Review",
        description: "Review is scheduled for 10 November 2026 at 7:00pm.",
        status: "in-progress",
        startedAt: "2026-11-05T18:00:00+02:00",
        completedAt: null,
        dueDate: "2026-11-10T19:00:00+02:00",
        duration: 5,
        emailIndexes: [4],
      },
      {
        name: "Launch",
        description: "Launch waits until the 10 November review.",
        status: "pending",
        startedAt: null,
        completedAt: null,
        dueDate: "2026-11-25T17:00:00+02:00",
        duration: 14,
        emailIndexes: [],
      },
    ],
  },
  {
    name: "Field Reports",
    client: "omar",
    contactEmail: "omar.client@raidtechs.com",
    contactName: "Omar Nassar",
    description: [
      "Field Reports collects weekly site counts for Omar Nassar.",
      "Field Reports for October show 46 submitted, 8 returned, and 3 missing.",
      "Review is in progress.",
      "Launch waits on sites 18 and 21.",
    ].join("\n"),
    repositoryUrl: "https://raidtechs.com/code/field-reports",
    applicationUrl: "https://raidtechs.com/apps/field-reports",
    createdAt: "2026-08-20T08:30:00+02:00",
    tasks: [{ title: "Chase the missing field reports", emailIndex: 4, stageIndex: 2 }],
    mails: [
      {
        from: "client",
        subject: "Field Reports kickoff",
        at: "2026-08-20T08:30:00+02:00",
        bullets: [
          "Field Reports kickoff was on 20 August 2026 at 8:30am",
          "Omar Nassar covers site visits for the north team",
          "Each report needs a date, a site, and a count",
          "Discussion closes on 3 September 2026",
        ],
      },
      {
        from: "admin",
        subject: "Field Reports scope",
        at: "2026-09-03T09:00:00+02:00",
        bullets: [
          "Field Reports scope is weekly site counts",
          "Discussion closed on 3 September 2026",
          "Build starts on 8 September 2026",
          "Omar Nassar will file every Friday",
        ],
      },
      {
        from: "client",
        subject: "Field Reports sample week",
        at: "2026-09-22T17:00:00+02:00",
        bullets: [
          "Field Reports sample week logged 12 site visits",
          "2 visits were returned for a missing count",
          "Build is halfway on 22 September 2026",
          "Omar Nassar asked for a status chart",
        ],
      },
      {
        from: "admin",
        subject: "Field Reports October counts",
        at: "2026-10-19T10:45:00+02:00",
        star: true,
        chart: {
          type: "pie",
          title: "Field Reports for October",
          labels: ["Submitted", "Returned", "Missing"],
          values: [46, 8, 3],
          enabled: true,
        },
        bullets: [
          "Field Reports for October show 46 submitted, 8 returned, and 3 missing",
          "Build finished on 19 October 2026",
          "Review starts on 27 October 2026",
          "Missing reports are sites 12, 18, and 21",
        ],
      },
      {
        from: "client",
        subject: "Field Reports review notes",
        at: "2026-11-04T15:00:00+02:00",
        bullets: [
          "Field Reports review is in progress on 4 November 2026",
          "Site 12 sent a corrected count",
          "Sites 18 and 21 are still missing",
          "Launch waits on those two sites",
        ],
      },
    ],
    stages: [
      {
        name: "Discussion",
        description: "Weekly site counts agreed on 3 September 2026.",
        status: "complete",
        startedAt: "2026-08-20T08:30:00+02:00",
        completedAt: "2026-09-03T09:00:00+02:00",
        dueDate: "2026-09-03T09:00:00+02:00",
        duration: 14,
        emailIndexes: [0, 1],
      },
      {
        name: "Build",
        description: "Build finished on 19 October 2026.",
        status: "complete",
        startedAt: "2026-09-08T09:00:00+02:00",
        completedAt: "2026-10-19T10:45:00+02:00",
        dueDate: "2026-10-19T10:45:00+02:00",
        duration: 41,
        emailIndexes: [2, 3],
      },
      {
        name: "Review",
        description: "Review is in progress. Sites 18 and 21 are still missing.",
        status: "in-progress",
        startedAt: "2026-10-27T09:00:00+02:00",
        completedAt: null,
        dueDate: "2026-11-12T17:00:00+02:00",
        duration: 16,
        emailIndexes: [4],
      },
      {
        name: "Launch",
        description: "Launch waits on the two missing sites.",
        status: "pending",
        startedAt: null,
        completedAt: null,
        dueDate: "2026-11-30T17:00:00+02:00",
        duration: 14,
        emailIndexes: [],
      },
    ],
  },
  {
    name: "Onboarding Kit",
    client: "demo",
    contactEmail: DEMO_CLIENT_EMAIL,
    contactName: "Demo Client",
    description: [
      "Onboarding Kit is four short lessons for Demo Client.",
      "Onboarding Kit lesson completion is 10%, 35%, 60%, and 80%.",
      "Prototype is in progress on 5 November 2026.",
      "Review has not started.",
    ].join("\n"),
    repositoryUrl: "https://raidtechs.com/code/onboarding-kit",
    applicationUrl: "https://raidtechs.com/apps/onboarding-kit",
    createdAt: "2026-10-06T09:40:00+02:00",
    tasks: [{ title: "Retry the invoice lesson", emailIndex: 2, stageIndex: 1 }],
    mails: [
      {
        from: "client",
        subject: "Onboarding Kit request",
        at: "2026-10-06T09:40:00+02:00",
        bullets: [
          "Onboarding Kit was requested on 6 October 2026 at 9:40am",
          "Demo Client needs four short lessons",
          "Each lesson is a checklist",
          "Discussion target is 14 October 2026",
        ],
      },
      {
        from: "admin",
        subject: "Onboarding Kit scope",
        at: "2026-10-14T11:00:00+02:00",
        bullets: [
          "Onboarding Kit discussion closed on 14 October 2026",
          "The four lessons are account, project, invoice, and review",
          "Prototype starts on 16 October 2026",
          "Demo Client will test lesson 1 on 20 October 2026",
        ],
      },
      {
        from: "client",
        subject: "Onboarding Kit lesson 1",
        at: "2026-10-27T16:10:00+02:00",
        bullets: [
          "Onboarding Kit lesson 1 passed on 27 October 2026",
          "Lesson 2 failed the invoice step",
          "Demo Client will retry on 30 October 2026 at 4:00pm",
          "Prototype is still in progress",
        ],
      },
      {
        from: "admin",
        subject: "Onboarding Kit progress",
        at: "2026-11-05T12:00:00+02:00",
        star: true,
        chart: {
          type: "line",
          title: "Onboarding Kit lesson completion",
          labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
          values: [10, 35, 60, 80],
          enabled: true,
        },
        bullets: [
          "Onboarding Kit lesson completion is 10%, 35%, 60%, and 80% across four weeks",
          "Prototype is in progress on 5 November 2026",
          "Review has not started",
          "Launch is planned for 18 November 2026",
        ],
      },
    ],
    stages: [
      {
        name: "Discussion",
        description: "Four lessons agreed on 14 October 2026.",
        status: "complete",
        startedAt: "2026-10-06T09:40:00+02:00",
        completedAt: "2026-10-14T11:00:00+02:00",
        dueDate: "2026-10-14T11:00:00+02:00",
        duration: 8,
        emailIndexes: [0, 1],
      },
      {
        name: "Prototype",
        description: "Lesson 1 passed. Lesson 2 still fails the invoice step.",
        status: "in-progress",
        startedAt: "2026-10-16T09:00:00+02:00",
        completedAt: null,
        dueDate: "2026-11-12T17:00:00+02:00",
        duration: 27,
        emailIndexes: [2, 3],
      },
      {
        name: "Review",
        description: "Review has not started.",
        status: "pending",
        startedAt: null,
        completedAt: null,
        dueDate: "2026-11-18T17:00:00+02:00",
        duration: 7,
        emailIndexes: [],
      },
      {
        name: "Launch",
        description: "Launch is planned for 18 November 2026.",
        status: "pending",
        startedAt: null,
        completedAt: null,
        dueDate: "2026-11-25T17:00:00+02:00",
        duration: 7,
        emailIndexes: [],
      },
    ],
  },
];

async function main() {
  const adminLogin = await supabase
    .from("User")
    .select("id, email, name, organizationId, role")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();
  if (adminLogin.error || !adminLogin.data) {
    throw new Error(adminLogin.error?.message ?? `${ADMIN_EMAIL} was not found`);
  }
  if (adminLogin.data.role !== "STAFF") throw new Error(`${ADMIN_EMAIL} is not staff`);

  const organizationId = adminLogin.data.organizationId as string;
  const admin: Person = {
    id: adminLogin.data.id,
    email: adminLogin.data.email,
    name: adminLogin.data.name,
  };

  const lina = await ensureClient(organizationId, "lina.client@raidtechs.com", "Lina Haddad");
  const omar = await ensureClient(organizationId, "omar.client@raidtechs.com", "Omar Nassar");

  const { data: people, error: peopleError } = await supabase
    .from("User")
    .select("id, email, name, role")
    .eq("organizationId", organizationId);
  if (peopleError || !people) throw new Error(peopleError?.message ?? "Could not read the organization");

  const demo = people.find((person) => person.email.toLowerCase() === DEMO_CLIENT_EMAIL);
  if (!demo) throw new Error(`${DEMO_CLIENT_EMAIL} was not found in this organization`);
  const demoClient: Person = { id: demo.id, email: demo.email, name: demo.name };

  const clients = { lina, omar, demo: demoClient };
  const dropped = await deleteSeedMail(people.map((person) => person.id));

  const existingProjects = await supabase
    .from("Project")
    .select("id")
    .eq("organizationId", organizationId)
    .in("name", [...PROJECT_NAMES]);
  if (existingProjects.error) throw new Error(existingProjects.error.message);
  const existingIds = (existingProjects.data ?? []).map((row) => row.id as string);

  let tasksSkipped = false;
  if (existingIds.length > 0) {
    const taskDelete = await supabase.from("Task").delete().in("projectId", existingIds);
    if (taskDelete.error) {
      if (!missingTable(taskDelete.error)) throw new Error(taskDelete.error.message);
      tasksSkipped = true;
      console.log("Task table is missing; skipped tasks.");
    }
  }

  if (existingIds.length > 0) {
    const projectDelete = await supabase.from("Project").delete().eq("organizationId", organizationId).in("id", existingIds);
    if (projectDelete.error) throw new Error(projectDelete.error.message);
  }

  const pipelineDelete = await supabase.from("Pipeline").delete().eq("userId", admin.id).in("projectName", [...PROJECT_NAMES]);
  if (pipelineDelete.error) throw new Error(pipelineDelete.error.message);

  const flags = new Map<string, Record<string, EmailMeta>>();
  const emailIds = new Map<string, string[]>();
  let emailCount = 0;
  for (const project of PROJECTS) {
    const client = clients[project.client];
    const ids = await sendThread(admin, client, project.mails, flags);
    emailIds.set(project.name, ids);
    emailCount += ids.length;
  }
  await writeMailboxes(organizationId, people.map((person) => person.id), dropped, flags);

  for (const person of people) {
    if (person.role !== "STAFF" || person.id === admin.id) continue;
    if (!companyContact(person.email, demoClient.email)) continue;
    await ensureContact(admin.id, person.name, person.email);
  }

  for (const project of PROJECTS) {
    const client = clients[project.client];
    const contactId = await ensureContact(admin.id, project.contactName, project.contactEmail);
    const inserted = await supabase
      .from("Project")
      .insert({
        organizationId,
        clientUserId: client.id,
        name: project.name,
        description: project.description,
        repositoryUrl: project.repositoryUrl,
        applicationUrl: project.applicationUrl,
        status: "ACTIVE",
        createdAt: stamp(project.createdAt),
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? `Could not save ${project.name}`);

    const ids = emailIds.get(project.name) ?? [];
    const stages = project.stages.map((plan, order) => ({ ...stageRow(plan, ids), order }));
    const pipeline = await supabase.from("Pipeline").insert({
      userId: admin.id,
      contactId,
      contactName: project.contactName,
      projectName: project.name,
      projectType: "development",
      status: "active",
      stages,
      completedAt: null,
      createdAt: stamp(project.createdAt),
      updatedAt: stamp("2026-11-06T12:00:00+02:00"),
    });
    if (pipeline.error) throw new Error(pipeline.error.message);

    if (tasksSkipped) continue;
    for (const task of project.tasks) {
      const saved = await supabase.from("Task").insert({
        organizationId,
        userId: admin.id,
        title: task.title,
        projectId: inserted.data.id,
        pipelineStageId: stages[task.stageIndex]?.id ?? null,
        emailId: ids[task.emailIndex] ?? null,
      });
      if (saved.error) {
        if (!missingTable(saved.error)) throw new Error(saved.error.message);
        if (!tasksSkipped) console.log("Task table is missing; skipped tasks.");
        tasksSkipped = true;
        break;
      }
    }
  }

  const template = await supabase.from("Template").select("id").eq("userId", admin.id).eq("name", "Sales update").maybeSingle();
  if (template.error) throw new Error(template.error.message);
  if (!template.data) {
    const inserted = await supabase.from("Template").insert({
      userId: admin.id,
      name: "Sales update",
      description: "Short facts plus one chart.",
      prompt: "Client Portal completion is 90%.\nBilling Dashboard review is on 10 November 2026 at 7:00pm.",
      isPublic: false,
      usageCount: 0,
    });
    if (inserted.error) throw new Error(inserted.error.message);
  }

  console.log(`Clients: ${demoClient.email}, ${lina.email}, ${omar.email}`);
  console.log(`Projects: ${PROJECT_NAMES.join(", ")}`);
  console.log(`Emails: ${emailCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
