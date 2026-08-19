import jwt from "jsonwebtoken";

// The app mints its own JWT after Supabase Auth verifies the
// credentials, rather than forwarding Supabase's session token as-is.
// Reason: `requireAuth` (middleware/auth.ts) needs `organizationId` in
// the payload to scope every data route by tenant, and Supabase's own
// session token has no knowledge of our `organizationId` column unless
// a custom access-token hook is configured in the Supabase dashboard.
// Minting our own token sidesteps that and keeps tenant scoping
// self-contained in this codebase.
export function signAppToken(userId: string, organizationId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ sub: userId, organizationId }, secret, { expiresIn: "7d" });
}
