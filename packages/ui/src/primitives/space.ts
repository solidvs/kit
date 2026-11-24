import type { Space, TokenName } from '../token';

/** `space.8` → `var(--ui-space-8)`. */
export function spaceVar(space: Space | undefined): string | undefined {
  return space ? `var(--ui-${space.replace('.', '-')})` : undefined;
}

/** `text.muted` → `var(--ui-text-muted)`. */
export function tokenVar(name: TokenName | undefined): string | undefined {
  return name ? `var(--ui-${name.replaceAll('.', '-')})` : undefined;
}
