import { supabase } from "../utils/supabaseClient";

export interface RawRecipient {
  name: string;
  email: string | null;
}

// Matches AI-extracted recipient names against the user's saved
// contacts (case-insensitive), falling back to whatever the AI
// returned when there's no match. Also bumps usage stats for
// matched contacts so "frequent contacts" suggestions improve.
export async function resolveRecipients(userId: string, raw: RawRecipient[]) {
  const { data: contacts, error } = await supabase
    .from("Contact")
    .select("*")
    .eq("userId", userId);

  if (error) throw error;

  const resolved = raw.map((r) => {
    const match = contacts?.find(
      (c) =>
        c.name.toLowerCase() === r.name.toLowerCase() ||
        (r.email && c.email.toLowerCase() === r.email.toLowerCase())
    );
    return match
      ? { name: match.name, email: match.email, contactId: match.id }
      : { name: r.name, email: r.email, contactId: null };
  });

  const matchedIds = resolved.map((r) => r.contactId).filter(Boolean) as string[];
  if (matchedIds.length) {
    try {
      await supabase.rpc("increment_contact_usage", { contact_ids: matchedIds });
    } catch (error) {
      // Optional RPC — fine if it doesn't exist yet; usage counts just won't bump.
      console.log('Contact usage increment skipped (RPC may not exist)');
    }
  }

  return resolved;
}
