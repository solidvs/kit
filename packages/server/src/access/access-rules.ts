import type { Principal } from '../identity/principal.js';

/**
 * Who may enter a system (ADR-0009). Department may open the door; it never grants a privileged
 * role. An empty rule denies everyone: a system must declare who enters.
 */
export type AccessRule = {
  readonly departments?: readonly string[];
  readonly groups?: readonly string[];
};

/** Roles inside the system. Granted by directory security groups only. */
export type RoleRules = Readonly<Record<string, { readonly groups: readonly string[] }>>;

export type AccessReason = { readonly by: 'department' | 'group'; readonly value: string };

export type AccessDecision =
  | { readonly allowed: true; readonly reason: AccessReason }
  | { readonly allowed: false; readonly reason: null };

/**
 * Canonical form for comparing directory names: case, accents and repeated spaces are ignored,
 * because the directory does not distinguish case and departments are typed by people.
 */
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function findMatch(candidates: readonly string[] | undefined, owned: ReadonlySet<string>): string | undefined {
  return candidates?.find((candidate) => owned.has(normalizeName(candidate)));
}

/** Decides entry and says why, so the decision can be shown and reviewed. */
export function decideAccess(principal: Principal, rule: AccessRule): AccessDecision {
  if (principal.department) {
    const department = findMatch(rule.departments, new Set([normalizeName(principal.department)]));
    if (department) return { allowed: true, reason: { by: 'department', value: department } };
  }
  const group = findMatch(rule.groups, new Set(principal.groups.map(normalizeName)));
  if (group) return { allowed: true, reason: { by: 'group', value: group } };
  return { allowed: false, reason: null };
}

/** Roles of the principal in this system, from group membership only. */
export function resolveRoles(principal: Principal, roles: RoleRules): string[] {
  const owned = new Set(principal.groups.map(normalizeName));
  return Object.entries(roles)
    .filter(([, rule]) => findMatch(rule.groups, owned) !== undefined)
    .map(([role]) => role)
    .sort();
}
