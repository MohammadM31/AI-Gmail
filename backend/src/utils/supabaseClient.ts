import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn(
    "[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. " +
      "Set them in backend/.env before hitting any data routes."
  );
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

export const supabase = createClient(url ?? "", key ?? "", clientOptions);

// signInWithPassword stores the user token on the client that called it.
// Storage and table writes must keep the service-role token, so password
// login uses this second client and never touches `supabase`.
export const supabaseAuth = createClient(url ?? "", key ?? "", clientOptions);
