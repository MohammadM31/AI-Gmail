export const COMPANY_DOMAIN = "@raidtechs.com";

export function normalizeAddress(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** True only for a single "@" followed by raidtechs.com, case-insensitive. */
export function isCompanyAddress(email: string | null | undefined): boolean {
  const value = normalizeAddress(email);
  return (
    value.length > COMPANY_DOMAIN.length &&
    value.endsWith(COMPANY_DOMAIN) &&
    value.indexOf("@") === value.length - COMPANY_DOMAIN.length
  );
}

/**
 * Returns the first address that is not a @raidtechs.com address or, when
 * `members` is given, is not one of those members. null means every address passes.
 */
export function rejectedAddress(
  addresses: ReadonlyArray<string | null | undefined>,
  members?: ReadonlyArray<{ email: string }>
): string | null {
  const known = members ? new Set(members.map((member) => normalizeAddress(member.email))) : null;
  for (const address of addresses) {
    const value = normalizeAddress(address);
    if (!isCompanyAddress(value) || (known && !known.has(value))) {
      return (address ?? "").trim() || "(empty address)";
    }
  }
  return null;
}

export function rejectionMessage(address: string): string {
  return `Cannot send to ${address}: recipients must be @raidtechs.com accounts in your organization.`;
}
