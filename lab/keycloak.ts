/**
 * Keycloak pieces of the laboratory: the realm templates and the files Keycloak mounts (the
 * platform login theme and the extensions of ADR-0018). They are copied into the run's work folder
 * because Docker on some machines (Colima) only shares the home folder, not the repository.
 * Build them first: `pnpm --filter @solidvs/keycloak-theme build` and
 * `pnpm --filter @solidvs/keycloak-extensions build`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LAB_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGES = join(LAB_DIR, '..', 'packages');
const THEME = join(PACKAGES, 'keycloak-theme', 'dist', 'platform');
const EXTENSIONS = join(PACKAGES, 'keycloak-extensions', 'dist', 'solidvs-keycloak-extensions.jar');

/** Copies the login theme and the extensions JAR into `<workdir>/keycloak`. */
export function stageKeycloak(workdir: string): void {
  for (const [path, name] of [
    [THEME, '@solidvs/keycloak-theme'],
    [EXTENSIONS, '@solidvs/keycloak-extensions'],
  ] as const) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run \`pnpm --filter ${name} build\``);
  }
  cpSync(THEME, join(workdir, 'keycloak', 'themes', 'platform'), { recursive: true });
  mkdirSync(join(workdir, 'keycloak', 'providers'), { recursive: true });
  cpSync(EXTENSIONS, join(workdir, 'keycloak', 'providers', basename(EXTENSIONS)));
}

/** A file of lab/identity with `{{KEY}}` placeholders replaced. */
export function renderIdentityTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), readFileSync(join(LAB_DIR, 'identity', template), 'utf8'));
}

/** Time-based one-time code (RFC 6238, SHA-1, 6 digits, 30 s), as the authenticator app shows it. */
export async function totp(secret: string, at = Date.now()): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac('sha1', Buffer.from(secret, 'utf8')).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
