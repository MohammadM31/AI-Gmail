import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn(
    "[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. " +
      "Set them in backend/.env before hitting any data routes."
  );
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: false },
});
