/**
 * Compares two screenshot folders pixel by pixel. Usage:
 * `node scripts/compare.ts <baseline-dir> <current-dir> <diff-dir>`.
 * Writes a diff image per screenshot that differs and prints the share of differing pixels.
 * Exit code 1 when any screenshot differs above the tolerance (anti-aliasing is ignored).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const [baselineDir, currentDir, diffDir] = process.argv.slice(2);
if (!baselineDir || !currentDir || !diffDir) throw new Error('Usage: node scripts/compare.ts <baseline> <current> <diff>');
const TOLERANCE = Number(process.env.TOLERANCE ?? '0.0005');

await mkdir(diffDir, { recursive: true });
let failed = 0;
for (const file of (await readdir(baselineDir)).filter((f) => f.endsWith('.png')).sort()) {
  let current: PNG;
  const baseline = PNG.sync.read(await readFile(join(baselineDir, file)));
  try {
    current = PNG.sync.read(await readFile(join(currentDir, file)));
  } catch {
    console.log(`MISSING  ${file}`);
    failed++;
    continue;
  }
  if (baseline.width !== current.width || baseline.height !== current.height) {
    console.log(`SIZE     ${file}  ${baseline.width}x${baseline.height} -> ${current.width}x${current.height}`);
    failed++;
    continue;
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const pixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, { threshold: 0.1 });
  const share = pixels / (baseline.width * baseline.height);
  const ok = share <= TOLERANCE;
  if (!ok) {
    failed++;
    await writeFile(join(diffDir, file), PNG.sync.write(diff));
  }
  console.log(`${ok ? 'OK      ' : 'DIFF    '} ${file}  ${(share * 100).toFixed(3)}%`);
}
process.exit(failed ? 1 : 0);
