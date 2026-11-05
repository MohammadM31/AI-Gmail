import "dotenv/config";
import { randomUUID } from "crypto";
import { supabase } from "../src/utils/supabaseClient";
import { createEmail } from "../src/services/emailProcessor";
import { loadMailbox, saveMailbox } from "../src/services/mailboxStore";

const SAMPLE = "Sample:";

async function main() {
  const adminLogin = await supabase
    .from("User")
    .select("id, email, name, organizationId, role")
    .eq("email", "demo-admin@example.com")
    .maybeSingle();
  if (adminLogin.error || !adminLogin.data) {
    throw new Error(adminLogin.error?.message ?? "demo-admin@example.com was not found");
  }

  const organizationId = adminLogin.data.organizationId;
  const { data: people, error: peopleError } = await supabase
    .from("User")
    .select("id, email, name, role")
    .eq("organizationId", organizationId);
  if (peopleError || !people) throw new Error(peopleError?.message ?? "Could not read the organization");

  const staff = people.filter((person) => person.role === "STAFF");
  const client = people.find((person) => person.email === "demo-client@example.com");
  if (!client) throw new Error("demo-client@example.com was not found in this organization");

  const { data: existingMail } = await supabase
    .from("Email")
    .select("id, senderId")
    .in("senderId", people.map((person) => person.id))
    .like("subject", `${SAMPLE}%`);
  for (const row of existingMail ?? []) {
    await supabase.from("Email").delete().eq("id", row.id);
  }

  await supabase.from("Project").delete().eq("organizationId", organizationId).eq("name", "Client Portal");

  const sent = await createEmail({
    senderId: client.id,
    recipients: staff.map((person) => ({ name: person.name, email: person.email, role: "to" as const })),
    subject: `${SAMPLE} Question about the Client Portal`,
    content: "When is the Client Portal prototype review?\nIs the 70% sales drop included?",
    bulletPoints: [
      "When is the Client Portal prototype review?",
      "Is the 70% sales drop included?",
    ],
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  for (const person of staff) {
    await ensureContact(person.id, "Hadi", "hadi@raidtechs.com");
    await ensureContact(person.id, "Sarah", "sarah@example.com");
    await ensureContact(person.id, client.name, client.email);

    const update = await createEmail({
      senderId: person.id,
      recipients: [{ name: client.name, email: client.email, role: "to" }],
      subject: `${SAMPLE} Client Portal sales update`,
      content: "Client Portal prototype review is on 18 November\nClient sales are down 70%",
      bulletPoints: [
        "Client Portal prototype review is on 18 November",
        "Client sales are down 70%",
      ],
      chartData: {
        type: "bar",
        title: "Client sales",
        labels: ["Decrease"],
        values: [70],
      },
      status: "sent",
      sentAt: new Date().toISOString(),
    });

    await createEmail({
      senderId: person.id,
      recipients: [{ name: "Hadi", email: "hadi@raidtechs.com", role: "to" }],
      subject: `${SAMPLE} Meeting at 7pm`,
      content: "Meeting at 7pm\nPossible prototype review\nBoss is joining",
      bulletPoints: ["Meeting at 7pm", "Possible prototype review", "Boss is joining"],
      status: "draft",
    });

    const mailbox = await loadMailbox(organizationId, person.id);
    mailbox.emails[update.id] = { folder: "sent", direction: "out", unread: false, starred: true };
    mailbox.emails[sent.id] = { direction: "in", unread: true, from: { name: client.name, email: client.email } };
    await saveMailbox(organizationId, person.id, mailbox);

    const contact = await supabase
      .from("Contact")
      .select("id")
      .eq("userId", person.id)
      .eq("email", "hadi@raidtechs.com")
      .maybeSingle();
    if (contact.data) {
      await supabase.from("Pipeline").upsert(
        {
          userId: person.id,
          contactId: contact.data.id,
          contactName: "Hadi",
          projectName: "Client Portal",
          projectType: "development",
          status: "active",
          stages: [
            stage("Discussion", "Scope agreed with the client.", "complete", 0),
            stage("Prototype", "Review on 18 November.", "in-progress", 1),
            stage("Launch", "Not started.", "pending", 2),
          ],
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        { onConflict: "userId,contactId" }
      );
    }

    const { data: template } = await supabase
      .from("Template")
      .select("id")
      .eq("userId", person.id)
      .eq("name", "Sales update")
      .maybeSingle();
    if (!template) {
      await supabase.from("Template").insert({
        userId: person.id,
        name: "Sales update",
        description: "Short facts plus one chart.",
        prompt: "Client sales fell 70%. Prototype review is next week.",
        isPublic: false,
        usageCount: 0,
      });
    }
  }

  await supabase.from("Project").insert({
    organizationId,
    clientUserId: client.id,
    name: "Client Portal",
    description:
      "Client Portal is the site clients use to follow their work.\nClient Portal prototype review is on 18 November\nClient sales are down 70%",
    repositoryUrl: null,
    applicationUrl: null,
    status: "ACTIVE",
  });

  console.log(`Seeded ${staff.length} staff mailboxes in this organization.`);
  console.log("Sign in as demo-admin@example.com to open Inbox, Projects, and Pipeline.");
}

function stage(name: string, description: string, status: "complete" | "in-progress" | "pending", order: number) {
  return {
    id: randomUUID(),
    name,
    description,
    status,
    order,
    startedAt: status === "pending" ? null : new Date().toISOString(),
    completedAt: status === "complete" ? new Date().toISOString() : null,
    dueDate: null,
    duration: 0,
    emailIds: [],
  };
}

async function ensureContact(userId: string, name: string, email: string) {
  const { data } = await supabase.from("Contact").select("id").eq("userId", userId).eq("email", email).maybeSingle();
  if (data) return;
  const { error } = await supabase.from("Contact").insert({ userId, name, email });
  if (error) throw new Error(error.message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exit(1);
});
