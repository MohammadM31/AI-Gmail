// backend/scripts/debug-classifier.ts
import "dotenv/config";
import { supabase } from "../src/utils/supabaseClient";

async function main() {
  console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
  console.log("Has service key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log();

  console.log("--- Query 1: select from Email ---");
  const r1 = await supabase
    .from("Email")
    .select("id, senderId, threadId, subject, content, createdAt")
    .eq("classification", "UNANALYZED")
    .is("deletedAt", null)
    .order("createdAt", { ascending: true })
    .limit(5);

  console.log("error:", r1.error);
  console.log("count:", r1.data?.length ?? 0);
  console.log();

  console.log("--- Query 2: select from User ---");
  const r2 = await supabase
    .from("User")
    .select("id, role, organizationId, name")
    .limit(5);

  console.log("error:", r2.error);
  console.log("count:", r2.data?.length ?? 0);
  console.log();

  console.log("--- Query 3: raw REST fetch ---");
  const url = `${process.env.SUPABASE_URL}/rest/v1/Email?select=id,senderId,threadId,subject,content,createdAt&classification=eq.UNANALYZED&deletedAt=is.null&order=createdAt.asc&limit=5`;
  console.log("URL:", url);
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  });
  console.log("status:", res.status);
  const body = await res.text();
  console.log("body:", body.slice(0, 500));

  process.exit(0);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});