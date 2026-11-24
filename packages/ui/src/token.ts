import type { TokenName } from './theme/token-names';

export type { TokenName } from './theme/token-names';

/**
 * CSS value of a platform token: `token('text.muted')` → `var(--ui-text-muted)`.
 * Styles use tokens, never raw values; the names are listed in `theme/token-names.ts`.
 */
export function token(name: TokenName): string {
  return `var(--ui-${name.replaceAll('.', '-')})`;
}

/** Spacing steps accepted by layout props, named by their size in pixels. */
export type Space =
  | 'space.0'
  | 'space.2'
  | 'space.4'
  | 'space.6'
  | 'space.8'
  | 'space.12'
  | 'space.16'
  | 'space.20'
  | 'space.24'
  | 'space.32'
  | 'space.40'
  | 'space.48'
  | 'space.64'
  | 'space.80';
