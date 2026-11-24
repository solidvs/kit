import { describe, expect, it } from 'vitest';

import type { Principal } from '../identity/principal.js';
import { decideAccess, normalizeName, resolveRoles } from './access-rules.js';

const person = (overrides: Partial<Principal> = {}): Principal => ({
  subject: 'u1',
  username: 'ana',
  name: 'Ana',
  groups: [],
  ...overrides,
});

describe('normalizeName', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(normalizeName('  Tecnologia   da INFORMAÇÃO ')).toBe('tecnologia da informacao');
  });
});

describe('decideAccess', () => {
  it('admits by department and says so', () => {
    expect(decideAccess(person({ department: 'ti' }), { departments: ['TI'] })).toEqual({
      allowed: true,
      reason: { by: 'department', value: 'TI' },
    });
  });

  it('admits by group, nested groups being resolved by the provider', () => {
    expect(decideAccess(person({ groups: ['GRP-Portal-Readers'] }), { groups: ['grp-portal-readers'] })).toEqual({
      allowed: true,
      reason: { by: 'group', value: 'grp-portal-readers' },
    });
  });

  it('denies other departments', () => {
    expect(decideAccess(person({ department: 'Vendas' }), { departments: ['TI'] }).allowed).toBe(false);
  });

  it('denies when the department claim is missing', () => {
    expect(decideAccess(person(), { departments: ['TI'] }).allowed).toBe(false);
  });

  it('denies everyone when the system declares no rule', () => {
    expect(decideAccess(person({ department: 'TI', groups: ['TI'] }), {}).allowed).toBe(false);
  });
});

describe('resolveRoles', () => {
  const roles = { admin: { groups: ['GRP-Portal-Admins'] }, auditor: { groups: ['GRP-Auditoria'] } };

  it('grants roles from groups only', () => {
    expect(resolveRoles(person({ groups: ['grp-portal-admins'] }), roles)).toEqual(['admin']);
  });

  it('never grants a role from the department', () => {
    expect(resolveRoles(person({ department: 'GRP-Portal-Admins' }), roles)).toEqual([]);
  });
});
