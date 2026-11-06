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

const WEEK_SECONDS = 7 * 24 * 60 * 60;

interface MemorySession {
  userId: string;
  expiresAt: number;
  revoked: boolean;
}

const sessions = new Map<string, MemorySession>();

export function signSessionToken(userId: string, organizationId: string, sessionId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ sub: userId, organizationId, sid: sessionId }, secret, { expiresIn: "7d" });
}

export function rememberSession(sessionId: string, userId: string): void {
  sessions.set(sessionId, { userId, expiresAt: Date.now() + WEEK_SECONDS * 1000, revoked: false });
}

export function revokeSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  const row = sessions.get(sessionId);
  if (row) row.revoked = true;
}

// true and false are decided. null means this process has not seen the session.
export function sessionKnown(sessionId: string | undefined): boolean | null {
  if (!sessionId) return false;
  const row = sessions.get(sessionId);
  if (!row) return null;
  if (row.revoked || row.expiresAt < Date.now()) return false;
  return true;
}

export function readCookieHeader(header: string | undefined, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function cookieFlags(): string {
  const prod = process.env.NODE_ENV === "production";
  return `Path=/; HttpOnly; SameSite=${prod ? "None" : "Lax"}${prod ? "; Secure" : ""}`;
}

export function sessionCookie(token: string): string {
  return `app_session=${token}; ${cookieFlags()}; Max-Age=${WEEK_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `app_session=; ${cookieFlags()}; Max-Age=0`;
}
