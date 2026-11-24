/**
 * Regenerates `src/icons/glyphs.ts` from the platform icon family's `library.json` (governance
 * repository, `design-system/icon-family/library.json`, itself generated and validated by
 * `design-system/scripts/check-icon-family.ts`). The family is the source of the drawings; this
 * package only carries them as data, keyed by export name without the `Icon` suffix.
 *
 * Usage (Node.js 24, no dependencies), from `packages/ui`:
 *   node scripts/generate-glyphs.ts <path/to/library.json>           # write src/icons/glyphs.ts
 *   node scripts/generate-glyphs.ts <path/to/library.json> --check   # fail when it is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type LibraryIcon = { name: string; exportName: string; group: string; meaning: string; body: string };
type Library = { viewBox: string; icons: LibraryIcon[] };

const [libraryPath] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const check = process.argv.includes('--check');
if (!libraryPath) throw new Error('Usage: node scripts/generate-glyphs.ts <library.json> [--check]');

const library = JSON.parse(readFileSync(libraryPath, 'utf8')) as Library;
if (library.viewBox !== '0 0 16 16') throw new Error(`Unexpected viewBox ${library.viewBox}`);

const lines = library.icons.map(({ exportName, meaning, body }) => {
  if (!/^[A-Z][A-Za-z0-9]*Icon$/.test(exportName)) throw new Error(`Unexpected export name ${exportName}`);
  if (/<(script|image|foreignObject)|href|on[a-z]+=/i.test(body)) throw new Error(`${exportName}: unsafe markup`);
  return `  // ${meaning}\n  ${exportName.slice(0, -'Icon'.length)}: ${JSON.stringify(body)},`;
});

const output = `/*
 * Platform icon family (design-system/icon-family in the governance repository): original glyphs on a
 * 16-unit grid, generated from its library.json by scripts/generate-glyphs.ts. Do not edit by hand.
 */
export const GLYPHS = {
${lines.join('\n')}
} as const;

export type GlyphName = keyof typeof GLYPHS;
`;

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons', 'glyphs.ts');
const current = readFileSync(target, 'utf8');
if (check) {
  if (current !== output) {
    console.error('src/icons/glyphs.ts is stale: run scripts/generate-glyphs.ts with the current library.json');
    process.exit(1);
  }
  console.log(`glyphs.ts up to date: ${library.icons.length} glyphs.`);
} else {
  writeFileSync(target, output);
  console.log(`${current === output ? 'Already up to date' : 'Wrote'} src/icons/glyphs.ts: ${library.icons.length} glyphs.`);
}
