/**
 * Screenshots every gallery section, light and dark, plus the interaction states that only exist
 * after a hover, a click or a keyboard focus. Usage: `node scripts/capture.ts <out-dir>` against a
 * running preview (`pnpm build && pnpm preview`, port 5180). Uses the installed Google Chrome, so no
 * browser download is needed.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';

const BASE = process.env.GALLERY_URL ?? 'http://localhost:5180';
const outDir = process.argv[2];
if (!outDir) throw new Error('Usage: node scripts/capture.ts <out-dir>');

const FREEZE = `*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important;caret-color:transparent!important}`;

type Shot = { name: string; section: string; act?: (page: Page) => Promise<void>; fullPage?: boolean };

const SHOTS: Shot[] = [
  { name: 'shell', section: 'shell' },
  { name: 'shell-home', section: 'shell-home' },
  { name: 'buttons', section: 'buttons', fullPage: true },
  { name: 'typography', section: 'typography', fullPage: true },
  { name: 'lozenges', section: 'lozenges', fullPage: true },
  { name: 'avatars', section: 'avatars', fullPage: true },
  { name: 'layout', section: 'layout', fullPage: true },
  { name: 'icons', section: 'icons', fullPage: true },
  { name: 'html', section: 'html', fullPage: true },
  {
    name: 'shell-nav-hover',
    section: 'shell-home',
    act: (page) => page.getByRole('link', { name: 'Integrações' }).hover(),
  },
  {
    name: 'shell-projects-hover',
    section: 'shell-home',
    act: (page) => page.getByRole('button', { name: 'Projetos', exact: true }).hover(),
  },
  {
    name: 'shell-theme-menu',
    section: 'shell-home',
    act: async (page) => {
      await page.getByRole('button', { name: 'Tema' }).click();
      await page.getByRole('menuitemradio').first().waitFor();
    },
  },
  {
    name: 'shell-tooltip',
    section: 'shell-home',
    act: async (page) => {
      await page.getByRole('button', { name: 'Notificações' }).hover();
      await page.getByRole('tooltip').waitFor();
    },
  },
  {
    name: 'shell-collapsed',
    section: 'shell-home',
    act: async (page) => {
      await page.getByRole('button', { name: 'Recolher barra lateral' }).click();
      await page.mouse.move(900, 600);
    },
  },
  {
    name: 'shell-focus',
    section: 'shell-home',
    act: async (page) => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
    },
  },
  {
    name: 'buttons-hover',
    section: 'buttons',
    act: (page) => page.getByRole('button', { name: 'Primário' }).hover(),
  },
  {
    name: 'board-card-hover',
    section: 'shell',
    act: (page) => page.getByRole('listitem', { name: 'Tela de deploys' }).hover(),
  },
  {
    name: 'project-tab-hover',
    section: 'shell',
    act: (page) => page.getByRole('tab', { name: 'Lista' }).hover(),
  },
  {
    name: 'search-focus',
    section: 'shell',
    act: (page) => page.getByRole('textbox', { name: 'Pesquisar' }).focus(),
  },
];

async function main() {
  await mkdir(outDir!, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const only = process.env.ONLY?.split(',');
  try {
    for (const mode of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: mode,
        reducedMotion: 'reduce',
        locale: 'pt-BR',
      });
      for (const shot of SHOTS) {
        if (only && !only.includes(shot.name)) continue;
        const page = await context.newPage();
        await page.goto(`${BASE}/?section=${shot.section}&mode=${mode}`, { waitUntil: 'networkidle' });
        await page.addStyleTag({ content: FREEZE });
        await page.evaluate(() => document.fonts.ready);
        if (shot.act) await shot.act(page);
        await page.waitForTimeout(400);
        const file = join(outDir!, `${shot.name}.${mode}.png`);
        await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
        console.log(file);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

await main();
