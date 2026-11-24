import { describe, expect, it } from 'vitest';

import { DEFINITION_KEYS, DEFINITION_KINDS, definitionKind, isDefinitionKey, parseDefinitionValue } from './kinds.js';

describe('definition kinds (ADR-0014): the schema check of every kind', () => {
  it.each(DEFINITION_KEYS)('%s: key, labels, scope, and its default passes its own schema', (key) => {
    const kind = definitionKind(key);
    expect(kind.key).toBe(key);
    expect(key).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/);
    expect(kind.label.length).toBeGreaterThan(0);
    expect(kind.description.length).toBeGreaterThan(0);
    expect(['platform', 'system']).toContain(kind.scope);
    expect(kind.schema.safeParse(kind.default).success).toBe(true);
    expect(kind.schema.safeParse(null).success).toBe(true);
  });

  it.each(DEFINITION_KEYS)('%s: refuses values of the wrong type', (key) => {
    expect(parseDefinitionValue(key, { nested: true }).success).toBe(false);
  });

  it('identity.forgotPasswordUrl: an https address only, public, platform scope', () => {
    const kind = DEFINITION_KINDS['identity.forgotPasswordUrl'];
    expect(kind.public).toBe(true);
    expect(kind.scope).toBe('platform');
    expect(parseDefinitionValue('identity.forgotPasswordUrl', 'https://servicos.example.com/senha').success).toBe(true);
    expect(parseDefinitionValue('identity.forgotPasswordUrl', 'http://servicos.example.com/senha').success).toBe(false);
    expect(parseDefinitionValue('identity.forgotPasswordUrl', 'javascript:alert(1)').success).toBe(false);
    expect(parseDefinitionValue('identity.forgotPasswordUrl', `https://example.com/${'a'.repeat(2000)}`).success).toBe(false);
  });

  it('knows its keys only', () => {
    expect(isDefinitionKey('identity.forgotPasswordUrl')).toBe(true);
    expect(isDefinitionKey('toString')).toBe(false);
    expect(isDefinitionKey('identity.unknown')).toBe(false);
  });
});
