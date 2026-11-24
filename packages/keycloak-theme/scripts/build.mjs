// Builds dist/platform: the theme sources plus the design-system files of @solidvs/ui, so the login
// pages use the same tokens, fonts, buttons and text fields as every system (ADR-0011).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ui = join(root, '..', 'ui');
const out = join(root, 'dist', 'platform');
const css = join(out, 'login', 'resources', 'css');
const fonts = join(out, 'login', 'resources', 'fonts');

rmSync(join(root, 'dist'), { recursive: true, force: true });
cpSync(join(root, 'src'), out, { recursive: true });
mkdirSync(fonts, { recursive: true });

for (const [from, to] of [
  ['src/theme/tokens.css', 'tokens.css'],
  ['src/theme/base.css', 'base.css'],
  ['src/button/button.css', 'button.css'],
  ['src/textfield/textfield.css', 'textfield.css'],
]) cpSync(join(ui, from), join(css, to));

// Inter, latin and latin-ext subsets, self-hosted with its license.
const require = createRequire(join(ui, 'package.json'));
const inter = dirname(require.resolve('@fontsource-variable/inter/package.json'));
const faces = [];
for (const [subset, range] of [
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
]) {
  const file = `inter-${subset}-wght-normal.woff2`;
  cpSync(join(inter, 'files', file), join(fonts, file));
  faces.push(`@font-face {\n  font-family: 'Inter Variable';\n  font-style: normal;\n  font-display: swap;\n  font-weight: 100 900;\n  src: url(../fonts/${file}) format('woff2-variations');\n  unicode-range: ${range};\n}`);
}
writeFileSync(join(css, 'fonts.css'), `/* Inter, SIL Open Font License 1.1 (see ../fonts/OFL-Inter.txt). */\n${faces.join('\n')}\n`);
cpSync(join(ui, 'licenses', 'OFL-Inter.txt'), join(fonts, 'OFL-Inter.txt'));

// Theme descriptor, so dist/ can also be packaged as a provider JAR.
mkdirSync(join(root, 'dist', 'META-INF'), { recursive: true });
writeFileSync(join(root, 'dist', 'META-INF', 'keycloak-themes.json'), JSON.stringify({ themes: [{ name: 'platform', types: ['login'] }] }, null, 2) + '\n');
console.log('built', out, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version);
