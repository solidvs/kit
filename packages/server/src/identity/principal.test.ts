import { describe, expect, it } from 'vitest';

import { InvalidClaimsError, principalFromClaims } from './principal.js';

describe('principalFromClaims', () => {
  it('maps the standard and directory claims', () => {
    expect(
      principalFromClaims({
        sub: 'abc',
        preferred_username: 'ana.souza',
        name: 'Ana Souza',
        email: 'ana@example.com',
        department: ' TI ',
        groups: ['/TI/GRP-Portal-Admins', 'Todos', 'Todos', 42],
      }),
    ).toEqual({
      subject: 'abc',
      username: 'ana.souza',
      name: 'Ana Souza',
      email: 'ana@example.com',
      department: 'TI',
      groups: ['GRP-Portal-Admins', 'Todos'],
    });
  });

  it('accepts other claim names for directory attributes', () => {
    const principal = principalFromClaims({ sub: 'x', dept: 'TI', roles_ad: ['A'] }, { department: 'dept', groups: 'roles_ad' });
    expect(principal.department).toBe('TI');
    expect(principal.groups).toEqual(['A']);
  });

  it('refuses claims without subject', () => {
    expect(() => principalFromClaims({ name: 'nobody' })).toThrow(InvalidClaimsError);
  });
});
