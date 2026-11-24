/** The signed-in person, as the identity provider describes them. */
export type Principal = {
  /** Stable subject identifier issued by the provider. */
  readonly subject: string;
  /** Directory login (sAMAccountName for AD). */
  readonly username: string;
  readonly name: string;
  readonly email?: string;
  readonly department?: string;
  /** Directory groups, nested membership included (resolved by the provider). */
  readonly groups: readonly string[];
};

export type ClaimMapping = {
  /** Claim that carries the directory department. Default: `department`. */
  readonly department: string;
  /** Claim that carries the group names. Default: `groups`. */
  readonly groups: string;
};

export const DEFAULT_CLAIM_MAPPING: ClaimMapping = { department: 'department', groups: 'groups' };

export class InvalidClaimsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidClaimsError';
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Group claims may come as paths (`/IT/Admins`); only the group's own name is kept. */
function groupName(value: string): string {
  const segments = value.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

/** Builds the principal from ID token claims; refuses claims without a subject. */
export function principalFromClaims(
  claims: Readonly<Record<string, unknown>>,
  mapping: ClaimMapping = DEFAULT_CLAIM_MAPPING,
): Principal {
  const subject = optionalString(claims.sub);
  if (!subject) throw new InvalidClaimsError('ID token without subject');

  const username = optionalString(claims.preferred_username) ?? subject;
  const rawGroups = claims[mapping.groups];
  const groups = Array.isArray(rawGroups)
    ? [...new Set(rawGroups.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map(groupName))]
    : [];
  const email = optionalString(claims.email);
  const department = optionalString(claims[mapping.department]);

  return {
    subject,
    username,
    name: optionalString(claims.name) ?? username,
    ...(email ? { email } : {}),
    ...(department ? { department } : {}),
    groups,
  };
}
