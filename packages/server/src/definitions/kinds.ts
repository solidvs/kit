import { z } from 'zod';

/**
 * Kinds of administered definitions (ADR-0014): what maintainers may set in the portal without a
 * code change. A new value needs no code; a new kind is a reviewed change here, with its test.
 * The portal validates every edit against the kind's schema and builds its screen from the labels;
 * systems validate what they read with the same schema.
 */
export type DefinitionScope = 'platform' | 'system';

export type DefinitionKind<T> = {
  readonly key: string;
  /** `platform`: one value for every system; `system`: one value per system (catalog id). */
  readonly scope: DefinitionScope;
  /** Public definitions are also served without authentication (`GET /api/public/definitions`). */
  readonly public: boolean;
  /** Field label and help in the portal, in Portuguese. */
  readonly label: string;
  readonly description: string;
  /** The value; `null` always means "not set", and the consumer falls back to `default`. */
  readonly schema: z.ZodType<T | null>;
  readonly default: T | null;
};

/** An https address of at most 2,000 characters: links shown to people. */
const httpsUrl = z
  .url({ protocol: /^https$/, message: 'endereço https completo' })
  .max(2000, 'até 2.000 caracteres');

function kind<T>(definition: DefinitionKind<T>): DefinitionKind<T> {
  return definition;
}

export const DEFINITION_KINDS = {
  /** The "Esqueci minha senha" link of the login page (ADR-0014, item 8). */
  'identity.forgotPasswordUrl': kind<string>({
    key: 'identity.forgotPasswordUrl',
    scope: 'platform',
    public: true,
    label: 'Link "Esqueci minha senha"',
    description:
      'Endereço aberto pelo link da tela de login. Sem valor, a tela mostra "Fale com a equipe de TI".',
    schema: httpsUrl.nullable(),
    default: null,
  }),
} as const;

export type DefinitionKey = keyof typeof DEFINITION_KINDS;
export type DefinitionValue<K extends DefinitionKey> = (typeof DEFINITION_KINDS)[K]['default'];

export const DEFINITION_KEYS = Object.keys(DEFINITION_KINDS) as DefinitionKey[];

export function isDefinitionKey(key: string): key is DefinitionKey {
  return Object.hasOwn(DEFINITION_KINDS, key);
}

export function definitionKind(key: DefinitionKey): DefinitionKind<unknown> {
  return DEFINITION_KINDS[key] as DefinitionKind<unknown>;
}

/** Validates a value against its kind; the error messages are in Portuguese, for the portal. */
export function parseDefinitionValue(key: DefinitionKey, value: unknown): z.ZodSafeParseResult<unknown> {
  return definitionKind(key).schema.safeParse(value);
}

/** Catalog ids name a system scope: lowercase letters, digits and hyphens. */
export const systemIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);

/** What the read API answers: active values by key, for one scope. */
export const definitionsResponseSchema = z.object({
  definitions: z.record(z.string(), z.unknown()),
});
export type DefinitionsResponse = z.infer<typeof definitionsResponseSchema>;
