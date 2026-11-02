#!/usr/bin/env node
// Renders all icon PNGs from the single source assets/icon/icon.svg (README §4.11).
// Requires rsvg-convert (librsvg2-bin). Usage: npm run icons
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'assets/icon');
const source = readFileSync(join(dir, 'icon.svg'), 'utf8');

const BG = '#1C6E8C'; // Classic light primary
const FG = '#F5F7FA'; // Classic light bg

// Inner shapes of the #glyph group (without its own transform/fill).
const m = /<g id="glyph"[^>]*>([\s\S]*?)<\/g>/.exec(source);
if (!m) throw new Error('assets/icon/icon.svg: <g id="glyph"> not found');
const shapes = m[1].replace(/<!--[\s\S]*?-->/g, '').trim();

/** Glyph scale relative to the 1024 canvas: at 1.0 the glyph tips span 66 % of the canvas. */
function svg({ background, color, scale = 0.95 }) {
  const bg = background ? `<rect width="1024" height="1024" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg}` +
    `<g fill="${color}" transform="translate(512 512) scale(${scale}) translate(-512 -512)">${shapes}</g></svg>`;
}

const variants = [
  // iOS app icon: no transparency.
  { file: 'icon-1024.png', size: 1024, svg: svg({ background: BG, color: FG }) },
  // Android adaptive icon foreground: transparent, glyph inside the 66 % safe zone (tips at ~56 %).
  { file: 'android-foreground.png', size: 1024, svg: svg({ color: FG, scale: 0.85 }) },
  { file: 'android-monochrome.png', size: 1024, svg: svg({ color: '#000000', scale: 0.85 }) },
  // Splash: primary glyph on transparent, readable on light and dark bg.
  { file: 'splash.png', size: 512, svg: svg({ color: BG, scale: 1.4 }) },
  { file: 'favicon-32.png', size: 32, svg: svg({ background: BG, color: FG, scale: 1.35 }) },
  { file: 'apple-touch-icon-180.png', size: 180, svg: svg({ background: BG, color: FG }) },
  { file: 'pwa-192.png', size: 192, svg: svg({ background: BG, color: FG }) },
  { file: 'pwa-512.png', size: 512, svg: svg({ background: BG, color: FG }) },
  // Maskable: glyph within the 80 % safe circle.
  { file: 'pwa-maskable-512.png', size: 512, svg: svg({ background: BG, color: FG, scale: 0.95 }) },
];

const tmp = mkdtempSync(join(tmpdir(), 'alp-icons-'));
try {
  for (const v of variants) {
    const input = join(tmp, v.file + '.svg');
    writeFileSync(input, v.svg);
    execFileSync('rsvg-convert', ['-w', String(v.size), '-h', String(v.size), '-o', join(dir, v.file), input]);
    console.log(`assets/icon/${v.file} (${v.size}px)`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
// Favicon SVG (also used by the web build as /favicon.svg via public/).
const favicon = svg({ background: BG, color: FG, scale: 1.35 });
writeFileSync(join(dir, 'favicon.svg'), favicon + '\n');
writeFileSync(join(root, 'public/favicon.svg'), favicon + '\n');
// PWA icons are served from public/ (copied verbatim into dist/ by expo export).
for (const f of ['apple-touch-icon-180.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png', 'favicon-32.png']) {
  writeFileSync(join(root, 'public/icons', f), readFileSync(join(dir, f)));
}
console.log('assets/icon/favicon.svg, public/favicon.svg, public/icons/*');
