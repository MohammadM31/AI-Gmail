// backend/src/services/recipientResolver.ts
import { supabase } from "../utils/supabaseClient";

export interface RawRecipient {
  name: string;
  email: string | null;
}

export interface ResolvedRecipient {
  name: string;
  email: string | null;
  contactId: string | null;
}

export async function resolveRecipients(
  userId: string,
  raw: RawRecipient[]
): Promise<ResolvedRecipient[]> {
  if (!raw || raw.length === 0) {
    return [];
  }

  const { data: contacts, error } = await supabase
    .from("Contact")
    .select("*")
    .eq("userId", userId);

  if (error) throw error;

  // ✅ FIX: Allow recipients with valid emails even if not in contacts
  const resolved = raw
    .map((r) => {
      // Try to find a contact match
      const match = contacts?.find(
        (c) =>
          c.name.toLowerCase() === r.name.toLowerCase() ||
          (r.email && c.email.toLowerCase() === r.email.toLowerCase())
      );
      
      if (match) {
        return { name: match.name, email: match.email, contactId: match.id };
      }
      
      // ✅ If no contact match but has a valid email, still allow it
      if (r.email && r.email.includes('@') && r.email.includes('.')) {
        return { name: r.name, email: r.email, contactId: null };
      }
      
      // ✅ If no email but name might be valid, allow it with caution
      if (r.name && r.name.trim().length > 0) {
        return { name: r.name, email: null, contactId: null };
      }
      
      return null;
    })
    .filter((r): r is ResolvedRecipient => r !== null);

  if (resolved.length === 0) {
    return [];
  }

  // Only increment usage for matched contacts
  const matchedIds = resolved
    .map((r) => r.contactId)
    .filter((id): id is string => id !== null);
    
  if (matchedIds.length) {
    try {
      await supabase.rpc("increment_contact_usage", { contact_ids: matchedIds });
    } catch (error) {
      console.log("Contact usage increment skipped (RPC may not exist)");
    }
  }

  return resolved;
}