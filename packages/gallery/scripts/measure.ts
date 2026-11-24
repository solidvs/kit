/**
 * Writes the computed styles of every visible element of gallery sections, as an indented tree.
 * Usage: GALLERY_URL=http://localhost:5180 node scripts/measure.ts <out-dir> "shell-home,shell-home@menu,buttons@dark"
 * Actions after @: menu, tooltip, collapsed, dark. WIDTH=<px> changes the viewport width.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
const out = process.argv[2]!; await mkdir(out, { recursive: true });
const sections = (process.argv[3] ?? 'shell,shell-home,buttons,typography,lozenges,avatars,layout').split(',');
const browser = await chromium.launch({ channel: 'chrome' });
async function dump(page: Page) {
  return page.evaluate(() => {
    const P = ['display','position','top','left','right','bottom','z-index','box-sizing','width','height','min-width','min-height','max-width','padding','margin','gap','row-gap','column-gap','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','align-items','justify-content','grid-template-columns','grid-template-rows','grid-template-areas','grid-area','font-family','font-size','font-weight','line-height','letter-spacing','text-transform','text-decoration-line','white-space','text-overflow','overflow','overflow-x','overflow-y','color','background-color','background-image','border-top','border-right','border-bottom','border-left','border-radius','box-shadow','outline','outline-offset','opacity','cursor','fill','stroke','vertical-align','inset-inline-start','inset-block-start','transform','transition','-webkit-line-clamp','content','pointer-events','visibility','isolation','object-fit','inset'];
    const defaults: Record<string,string> = {};
    const probe = document.createElement('div'); document.body.appendChild(probe);
    const pcs = getComputedStyle(probe); for (const p of P) defaults[p] = pcs.getPropertyValue(p); probe.remove();
    const lines: string[] = [];
    const walk = (el: Element, depth: number, parentCs?: CSSStyleDeclaration) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      const props: string[] = [];
      for (const p of P) { const v = cs.getPropertyValue(p); const inh = ['font-family','font-size','font-weight','line-height','letter-spacing','color','text-transform','white-space','cursor','visibility','fill'].includes(p);
        if (inh ? (parentCs && v === parentCs.getPropertyValue(p)) : v === defaults[p]) continue;
        if (['width','height','inset-inline-start','inset-block-start'].includes(p)) continue;
        if (p.startsWith('border-') && p !== 'border-radius' && v.startsWith('0px')) continue;
        if (p === 'outline' && / none /.test(v)) continue;
        if (['top','left','right','bottom','inset'].includes(p) && (v === '0px' || v === 'auto')) continue;
        if (['min-width','min-height'].includes(p) && v === 'auto') continue;
        props.push(`${p}:${v}`); }
      const attrs = ['role','aria-label','aria-selected','aria-current','aria-expanded','data-testid','href','type','tabindex'].map(a => el.getAttribute(a) != null ? `${a}=${JSON.stringify(el.getAttribute(a)!.slice(0,40))}` : '').filter(Boolean).join(' ');
      const text = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent!.trim()).join(' ').slice(0, 40);
      for (const pseudo of ['::before','::after']) { const ps = getComputedStyle(el, pseudo); if (ps.content && ps.content !== 'none' && ps.content !== 'normal') props.push(`${pseudo}{content:${ps.content};display:${ps.display};position:${ps.position};inset:${ps.inset};w:${ps.width};h:${ps.height};bg:${ps.backgroundColor};border:${ps.borderTop}|${ps.borderBottom};radius:${ps.borderRadius};shadow:${ps.boxShadow};pe:${ps.pointerEvents}}`); }
      lines.push(`${'  '.repeat(depth)}<${el.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}> [${Math.round(r.x*10)/10},${Math.round(r.y*10)/10} ${Math.round(r.width*10)/10}x${Math.round(r.height*10)/10}]${text ? ' "' + text + '"' : ''} ${props.join('; ')}`);
      if (el.tagName === 'svg') { lines.push(`${'  '.repeat(depth+1)}(svg viewBox=${el.getAttribute('viewBox')} w=${el.getAttribute('width')} h=${el.getAttribute('height')})`); return; }
      for (const c of Array.from(el.children)) walk(c, depth + 1, cs);
    };
    walk(document.body, 0);
    return lines.join('\n');
  });
}
for (const spec of sections) {
  const viewport = { width: Number(process.env.WIDTH ?? 1440), height: 900 }; const [s, act] = spec.split('@'); const mode = act === 'dark' ? 'dark' : 'light';
  const page = await browser.newPage({ viewport });
  await page.goto(`${process.env.GALLERY_URL ?? 'http://localhost:5180'}/?section=${s}&mode=${mode}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (act === 'menu') { await page.getByRole('button', { name: 'Tema' }).click(); await page.waitForTimeout(500); }
  if (act === 'tooltip') { await page.getByRole('button', { name: 'Notificações' }).hover(); await page.getByRole('tooltip').waitFor(); await page.waitForTimeout(300); }
  if (act === 'collapsed') { await page.getByRole('button', { name: 'Recolher barra lateral' }).click(); await page.waitForTimeout(500); }
  if (act === 'dark') {}
  await writeFile(`${out}/${spec.replace('@','_')}.txt`, await dump(page));
  await page.close();
}
await browser.close();
