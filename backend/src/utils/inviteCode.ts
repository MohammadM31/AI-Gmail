import crypto from "crypto";

// Short, URL-safe code a teammate can be given to join an existing
// organization at signup instead of creating a new one.
export function generateInviteCode(): string {
  return crypto.randomBytes(8).toString("hex").toUpperCase().slice(0, 12);
}