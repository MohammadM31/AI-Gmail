import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { processMessageWithAI } from "./geminiService";
import { chartSpec, factSpec, statedNumberChart, storeInfographic } from "./infographicService";
import { createEmail } from "./emailProcessor";
import { mutateMailbox } from "./mailboxStore";

interface Note {
  subject: string;
  bulletPoints: string[] | null;
  createdAt: string;
}

function since(scope: "daily" | "contact"): string {
  const date = new Date();
  date.setDate(date.getDate() - (scope === "daily" ? 1 : 30));
  return date.toISOString();
}

export async function buildDigest(
  organizationId: string,
  userId: string,
  scope: "daily" | "contact",
  contactId?: string
): Promise<{ emailId: string }> {
  const { data: actor, error: actorError } = await supabase
    .from("User")
    .select("id, email, name")
    .eq("id", userId)
    .eq("organizationId", organizationId)
    .single();
  if (actorError || !actor) throw new ApiError(404, "User not found");

  const { data: people, error: peopleError } = await supabase
    .from("User")
    .select("id")
    .eq("organizationId", organizationId);
  if (peopleError) throw new ApiError(500, peopleError.message);
  const ids = (people ?? []).map((person) => person.id);

  let contactName = "";
  if (scope === "contact") {
    if (!contactId) throw new ApiError(400, "Choose a contact");
    const { data: contact, error: contactError } = await supabase
      .from("User")
      .select("id, name")
      .eq("id", contactId)
      .eq("organizationId", organizationId)
      .maybeSingle();
    if (contactError) throw new ApiError(500, contactError.message);
    if (!contact) throw new ApiError(400, "That contact is not in this organization");
    contactName = contact.name;
  }

  let query = supabase
    .from("Email")
    .select("subject, bulletPoints, createdAt, senderId")
    .in("senderId", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"])
    .gte("createdAt", since(scope))
    .order("createdAt", { ascending: false })
    .limit(30);
  if (scope === "contact" && contactId) query = query.eq("senderId", contactId);
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);

  const notes = (data ?? []) as Note[];
  const lines = notes
    .map((note) => `${note.subject}: ${(note.bulletPoints ?? []).join("; ")}`)
    .join("\n");
  const prompt = [
    scope === "contact" ? `Digest the notes from ${contactName}.` : "Digest today's company notes.",
    "Return 3 to 5 short bullets and one chart. Do not write a paragraph.",
    lines || "No notes in this period.",
  ].join("\n");

  const draft = await processMessageWithAI(prompt, [], "en-US");
  const bullets = draft.bulletPoints.map((bullet) => bullet.trim()).filter(Boolean).slice(0, 5);
  if (bullets.length === 0) bullets.push("No changes in this period.");

  const spec = chartSpec(draft.chart) ?? factSpec(draft.graphic ?? null) ?? statedNumberChart(bullets.join(" "));
  let chartData: {
    type: string;
    title: string;
    labels: string[];
    values: number[];
    facts?: string[];
    imagePath?: string;
    enabled: boolean;
  } = { type: "bar", title: "", labels: [], values: [], enabled: false };
  if (spec) {
    const imagePath = (await storeInfographic(organizationId, userId, spec)) ?? undefined;
    chartData = {
      type: spec.kind === "chart" ? spec.type ?? "bar" : "bar",
      title: spec.title ?? "Digest",
      labels: spec.kind === "chart" ? spec.labels ?? [] : [],
      values: spec.kind === "chart" ? spec.values ?? [] : [],
      facts: spec.kind === "facts" ? spec.facts : undefined,
      imagePath,
      enabled: true,
    };
  }

  const subject = scope === "contact" ? `Digest for ${contactName}` : "Daily digest";
  const email = await createEmail({
    senderId: userId,
    recipients: [{ name: actor.name, email: actor.email }],
    subject,
    content: bullets.join("\n"),
    bulletPoints: bullets,
    chartData,
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  await mutateMailbox(organizationId, userId, (doc) => {
    doc.emails[email.id] = {
      folder: "inbox",
      unread: true,
      direction: "in",
      from: { name: "Digest", email: actor.email },
      deliveryStatus: "internal",
    };
  });

  return { emailId: email.id };
}
